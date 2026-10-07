import { z } from "zod";

export interface Repo {
  description: string;
  forks: number;
  language?: string;
  name: string;
  stars: number;
  topics: string[];
  url: string;
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

type RawRepo = z.infer<typeof RawRepoSchema>;

const maxRepos = 4;
const maxTopics = 3;

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
      name: repo.name,
      stars: repo.stargazers_count,
      topics: repo.topics.slice(0, maxTopics),
      url: repo.html_url,
    }));

export const getRepos = async (
  login: string,
  fetchImpl: typeof fetch = fetch
): Promise<Repo[]> => {
  const token = process.env.GITHUB_TOKEN;
  const response = await fetchImpl(
    `https://api.github.com/users/${login}/repos?per_page=100&type=owner&sort=pushed`,
    {
      cache: "force-cache",
      headers: {
        Accept: "application/vnd.github+json",
        ...(token && { Authorization: `Bearer ${token}` }),
        "User-Agent": "stevanpavlovic.com build",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  if (response.status !== 200) {
    throw new Error(`GitHub API ${response.status} for ${login}`);
  }
  return selectRepos(RawReposSchema.parse(await response.json()), login);
};
