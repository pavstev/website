import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as z from "zod";

import { type BuildEnv, isPreviewBuild } from "./blog/build-env.ts";

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

export type GitHubSnapshot = Record<string, unknown>;

export interface GitHubSource {
  env?: BuildEnv;
  fetch?: typeof fetch;
  snapshot?: () => GitHubSnapshot;
  token?: () => string | undefined;
  warn?: (line: string) => void;
}

interface Client {
  auth: string | undefined;
  fetch: typeof fetch;
  replay: boolean;
}

export const githubSnapshotPath = "src/lib/github-snapshot.json";

const SnapshotSchema = z.record(z.string(), z.unknown());

const readSnapshot = (): GitHubSnapshot => {
  const text = readFileSync(githubSnapshotPath, "utf8");
  return SnapshotSchema.parse(JSON.parse(text));
};

let warned = false;

const warnOnce = (line: string): void => {
  if (warned) return;
  warned = true;
  console.warn(line);
};

const bodyText = (body: RequestInit["body"]): string | undefined =>
  typeof body === "string" ? body : undefined;

export const requestKey = (url: string, init?: RequestInit): string => {
  const target = url.startsWith(api) ? url.slice(api.length) : url;
  const method = init?.method ?? "GET";
  const body = bodyText(init?.body);
  if (body === undefined) return `${method} ${target}`;
  const digest = createHash("sha256").update(body).digest("hex").slice(0, 16);
  return `${method} ${target} ${digest}`;
};

const requestUrl = (input: Parameters<typeof fetch>[0]): string => {
  if (typeof input === "string") return input;
  return input instanceof Request ? input.url : input.href;
};

const replayFetch =
  (snapshot: GitHubSnapshot): typeof fetch =>
  (input, init) => {
    const key = requestKey(requestUrl(input), init);
    if (!Object.hasOwn(snapshot, key)) {
      return Promise.reject(
        new Error(
          `${githubSnapshotPath} has no answer for ${key}; run pnpm github:snapshot`
        )
      );
    }
    const answer = snapshot[key];
    return Promise.resolve(
      typeof answer === "string"
        ? new Response(answer, { headers: { "Content-Type": "text/html" } })
        : Response.json(answer)
    );
  };

const client = ({
  env = process.env,
  fetch: fetchImpl = fetch,
  snapshot = readSnapshot,
  token: readToken = token,
  warn = warnOnce,
}: GitHubSource): Client => {
  const auth = readToken();
  if (auth || !isPreviewBuild(env)) {
    return { auth, fetch: fetchImpl, replay: false };
  }
  warn(
    `GITHUB_TOKEN is not set on preview branch ${env.WORKERS_CI_BRANCH ?? ""}, so the build replays ${githubSnapshotPath}`
  );
  return { auth: undefined, fetch: replayFetch(snapshot()), replay: true };
};

const headers = (auth?: string): Record<string, string> => ({
  Accept: "application/vnd.github+json",
  ...(auth && { Authorization: `Bearer ${auth}` }),
  "User-Agent": "stevanpavlovic.com build",
  "X-GitHub-Api-Version": "2022-11-28",
});

const request = async (path: string, github: Client): Promise<unknown> => {
  const response = await github.fetch(`${api}${path}`, {
    cache: "force-cache",
    headers: headers(github.auth),
  });
  if (response.status !== 200) {
    throw new Error(`GitHub API ${String(response.status)} for ${path}`);
  }
  return response.json();
};

const requestText = async (
  path: string,
  body: Record<string, string>,
  github: Client
): Promise<string> => {
  const response = await github.fetch(`${api}${path}`, {
    body: JSON.stringify(body),
    cache: "force-cache",
    headers: { ...headers(github.auth), "Content-Type": "application/json" },
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
  github: Client
): Promise<unknown> => {
  if (!github.auth && !github.replay) {
    throw new Error("GitHub GraphQL needs GITHUB_TOKEN");
  }
  const response = await github.fetch(`${api}/graphql`, {
    body: JSON.stringify({ query, variables }),
    cache: "force-cache",
    headers: headers(github.auth),
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
  source: GitHubSource = {}
): Promise<Repo[]> => {
  const github = client(source);
  const raw = RawReposSchema.parse(
    await request(
      `/users/${login}/repos?per_page=100&type=owner&sort=pushed`,
      github
    )
  );
  return Promise.all(
    selectRepos(raw, login).map(async (repo) => ({
      ...repo,
      languages: languageShares(
        RawGraphLanguagesSchema.parse(
          await graph(languagesQuery, { name: repo.name, owner: login }, github)
        ).data.repository.languages.edges,
        repo.language
      ),
    }))
  );
};

export const getContact = async (
  login: string,
  source: GitHubSource = {}
): Promise<Contact> => {
  const github = client(source);
  const [userData, socialData] = await Promise.all([
    request(`/users/${login}`, github),
    request(`/users/${login}/social_accounts`, github),
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
  source: GitHubSource = {}
): Promise<Project> => {
  const github = client(source);
  const base = `/repos/${login}/${repo}`;
  const [info, readme, releases] = await Promise.all([
    request(base, github),
    request(`${base}/readme`, github),
    request(`${base}/releases?per_page=5`, github),
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
      github
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
