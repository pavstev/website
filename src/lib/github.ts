import { execFileSync } from "node:child_process";
import * as z from "zod";

export interface Contact {
  email: string;
  linkedin: string;
  linkedinHandle: string;
}

export interface Project {
  defaultBranch: string;
  readmeHtml: string;
  releases: Release[];
}

export interface Release {
  assets: ReleaseAsset[];
  name: string;
  publishedAt: string;
  tag: string;
  url: string;
}

export interface ReleaseAsset {
  name: string;
  size: number;
  url: string;
}

export interface Repo {
  description: string;
  forks: number;
  language?: string | undefined;
  languages: RepoLanguage[];
  name: string;
  stars: number;
  topics: string[];
  url: string;
}

export interface RepoLanguage {
  color?: string | undefined;
  name: string;
}

const RawRepoSchema = z.object({
  archived: z.boolean(),
  description: z.string().nullable(),
  fork: z.boolean(),
  forks_count: z.number(),
  html_url: z.string(),
  language: z.string().nullable(),
  name: z.string(),
  pushed_at: z.string().nullable(),
  stargazers_count: z.number(),
  topics: z.array(z.string()).default([]),
});

const RawReposSchema = z.array(RawRepoSchema);

const RawUserSchema = z.object({ email: z.string().nullable() });

const RawSocialSchema = z.array(
  z.object({ provider: z.string(), url: z.string() })
);

const RawLanguageEdgeSchema = z.object({
  node: z.object({
    color: z
      .string()
      .regex(/^#[\da-f]{6}$/i)
      .nullable()
      .catch(null),
    name: z.string(),
  }),
  size: z.number(),
});

const RawLanguageConnectionSchema = z.object({
  edges: z.array(RawLanguageEdgeSchema),
});

const RawGraphLanguagesSchema = z.object({
  data: z.object({
    repository: z.object({ languages: RawLanguageConnectionSchema }),
  }),
});

const RawRepoInfoSchema = z.object({ default_branch: z.string() });

const RawReadmeSchema = z.object({ content: z.string() });

const RawAssetSchema = z.object({
  browser_download_url: z.string(),
  name: z.string(),
  size: z.number(),
});

const RawReleaseSchema = z.object({
  assets: z.array(RawAssetSchema),
  draft: z.boolean(),
  html_url: z.string(),
  name: z.string().nullable(),
  prerelease: z.boolean(),
  published_at: z.string().nullable(),
  tag_name: z.string(),
});

const RawReleasesSchema = z.array(RawReleaseSchema);

type RawLanguageEdge = z.infer<typeof RawLanguageEdgeSchema>;

const languagesQuery = `query ($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    languages(first: 20, orderBy: { field: SIZE, direction: DESC }) {
      edges { size node { name color } }
    }
  }
}`;

type RawRepo = z.infer<typeof RawRepoSchema>;

const maxRepos = 4;
const maxTopics = 6;
const minLanguageShare = 0.03;
const api = "https://api.github.com";

const pushedTime = (repo: RawRepo): number => {
  const time = Date.parse(repo.pushed_at ?? "");
  return Number.isNaN(time) ? 0 : time;
};

const selectRepos = (raw: RawRepo[], login: string): Repo[] =>
  raw
    .filter(
      (repo) =>
        !repo.fork &&
        !repo.archived &&
        repo.name !== login &&
        (repo.description?.trim().length ?? 0) > 0
    )
    .toSorted(
      (a, b) =>
        b.stargazers_count - a.stargazers_count || pushedTime(b) - pushedTime(a)
    )
    .slice(0, maxRepos)
    .map((repo) => ({
      description: repo.description?.trim() ?? "",
      forks: repo.forks_count,
      language: repo.language ?? undefined,
      languages: repo.language ? [{ name: repo.language }] : [],
      name: repo.name,
      stars: repo.stargazers_count,
      topics: repo.topics.slice(0, maxTopics),
      url: repo.html_url,
    }));

let cliToken: null | string | undefined;

const localToken = (): string | undefined => {
  if (cliToken === undefined) {
    try {
      cliToken =
        execFileSync("gh", ["auth", "token"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
          timeout: 5000,
        }).trim() || null;
    } catch {
      cliToken = null;
    }
  }
  return cliToken ?? undefined;
};

const token = (): string | undefined =>
  process.env["GITHUB_TOKEN"] ?? localToken();

const headers = (auth?: string): Record<string, string> => ({
  Accept: "application/vnd.github+json",
  ...(auth && { Authorization: `Bearer ${auth}` }),
  "User-Agent": "stevanpavlovic.com build",
  "X-GitHub-Api-Version": "2022-11-28",
});

const request = async (
  path: string,
  fetchImpl: typeof fetch
): Promise<unknown> => {
  const response = await fetchImpl(`${api}${path}`, {
    cache: "force-cache",
    headers: headers(token()),
  });
  if (response.status !== 200) {
    throw new Error(`GitHub API ${String(response.status)} for ${path}`);
  }
  return response.json();
};

const requestText = async (
  path: string,
  body: Record<string, string>,
  fetchImpl: typeof fetch
): Promise<string> => {
  const response = await fetchImpl(`${api}${path}`, {
    body: JSON.stringify(body),
    cache: "force-cache",
    headers: { ...headers(token()), "Content-Type": "application/json" },
    method: "POST",
  });
  if (response.status !== 200) {
    throw new Error(`GitHub API ${String(response.status)} for ${path}`);
  }
  return response.text();
};

const graph = async (
  query: string,
  variables: Record<string, string>,
  fetchImpl: typeof fetch
): Promise<unknown> => {
  const auth = token();
  if (!auth) throw new Error("GitHub GraphQL needs GITHUB_TOKEN");
  const response = await fetchImpl(`${api}/graphql`, {
    body: JSON.stringify({ query, variables }),
    cache: "force-cache",
    headers: headers(auth),
    method: "POST",
  });
  if (response.status !== 200) {
    throw new Error(`GitHub GraphQL ${String(response.status)}`);
  }
  return response.json();
};

const languageShares = (
  edges: RawLanguageEdge[],
  primary?: string
): RepoLanguage[] => {
  const total = edges.reduce((sum, edge) => sum + edge.size, 0);
  const shown = edges
    .filter((edge) => total > 0 && edge.size / total >= minLanguageShare)
    .toSorted((a, b) => b.size - a.size)
    .map(({ node }) => ({ color: node.color ?? undefined, name: node.name }));
  if (primary && shown.every((language) => language.name !== primary)) {
    const color = edges.find((edge) => edge.node.name === primary)?.node.color;
    shown.unshift({ color: color ?? undefined, name: primary });
  }
  return shown;
};

export const getRepos = async (
  login: string,
  fetchImpl: typeof fetch = fetch
): Promise<Repo[]> => {
  const raw = RawReposSchema.parse(
    await request(
      `/users/${login}/repos?per_page=100&type=owner&sort=pushed`,
      fetchImpl
    )
  );
  return Promise.all(
    selectRepos(raw, login).map(async (repo) => ({
      ...repo,
      languages: languageShares(
        RawGraphLanguagesSchema.parse(
          await graph(
            languagesQuery,
            { name: repo.name, owner: login },
            fetchImpl
          )
        ).data.repository.languages.edges,
        repo.language
      ),
    }))
  );
};

export const getContact = async (
  login: string,
  fetchImpl: typeof fetch = fetch
): Promise<Contact> => {
  const [userData, socialData] = await Promise.all([
    request(`/users/${login}`, fetchImpl),
    request(`/users/${login}/social_accounts`, fetchImpl),
  ]);
  const user = RawUserSchema.parse(userData);
  const social = RawSocialSchema.parse(socialData);
  const email = user.email?.trim() ?? "";
  if (!email) throw new Error(`GitHub profile ${login} has no public email`);
  const linkedin = social.find(
    (account) => account.provider === "linkedin"
  )?.url;
  if (!linkedin) throw new Error(`GitHub profile ${login} has no LinkedIn`);
  const linkedinHandle =
    new URL(linkedin).pathname.split("/").findLast(Boolean) ?? "";
  return { email, linkedin, linkedinHandle };
};

const releaseName = (release: z.infer<typeof RawReleaseSchema>): string => {
  const name = release.name?.trim() ?? "";
  return name.length > 0 ? name : release.tag_name;
};

const releasePublishedAt = (
  release: z.infer<typeof RawReleaseSchema>
): string => {
  if (!release.published_at) {
    throw new Error(`GitHub release ${release.tag_name} has no publish date`);
  }
  return release.published_at;
};

export const getProject = async (
  login: string,
  repo: string,
  fetchImpl: typeof fetch = fetch
): Promise<Project> => {
  const base = `/repos/${login}/${repo}`;
  const [info, readme, releases] = await Promise.all([
    request(base, fetchImpl),
    request(`${base}/readme`, fetchImpl),
    request(`${base}/releases?per_page=5`, fetchImpl),
  ]);
  const text = Buffer.from(
    RawReadmeSchema.parse(readme).content,
    "base64"
  ).toString("utf8");
  return {
    defaultBranch: RawRepoInfoSchema.parse(info).default_branch,
    readmeHtml: await requestText(
      "/markdown",
      { context: `${login}/${repo}`, mode: "gfm", text },
      fetchImpl
    ),
    releases: RawReleasesSchema.parse(releases)
      .filter((release) => !release.draft && !release.prerelease)
      .map((release) => ({
        assets: release.assets.map((asset) => ({
          name: asset.name,
          size: asset.size,
          url: asset.browser_download_url,
        })),
        name: releaseName(release),
        publishedAt: releasePublishedAt(release),
        tag: release.tag_name,
        url: release.html_url,
      })),
  };
};
