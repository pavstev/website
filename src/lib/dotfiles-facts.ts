import * as z from "zod";

import { graph, request } from "./github.ts";

export interface BlobTexts {
  guard: string;
  hooks: string;
  install: string;
  tools: string;
}

export interface DotfilesFacts {
  agents: number;
  files: number;
  forks: number;
  guardChecks: number;
  homeFiles: number;
  hookEvents: number;
  installSteps: number;
  presets: number;
  pushedAt: string;
  rustShare: number;
  skillNames: string[];
  skills: number;
  stars: number;
  tools: number;
}

export interface TreeEntry {
  path: string;
  type: string;
}

type TreeCounts = Pick<
  DotfilesFacts,
  "agents" | "files" | "homeFiles" | "presets" | "skillNames" | "skills"
>;

const owner = "pavstev";
const repoName = "dotfiles";
const repoPath = `/repos/${owner}/${repoName}`;

const RepoSchema = z.object({
  forks_count: z.number(),
  pushed_at: z.string(),
  stargazers_count: z.number(),
});

const TreeEntrySchema = z.object({ path: z.string(), type: z.string() });

const TreeSchema = z.object({
  tree: z.array(TreeEntrySchema),
  truncated: z.boolean(),
});

const LanguagesSchema = z.record(z.string(), z.number());

const blobText = z.object({ text: z.string() });

const BlobTextsSchema = z.object({
  data: z.object({
    repository: z.object({
      guard: blobText,
      hooks: blobText,
      install: blobText,
      tools: blobText,
    }),
  }),
});

const HooksSchema = z.object({ hooks: z.record(z.string(), z.unknown()) });

const blobsQuery = `query ($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    tools: object(expression: "HEAD:tools.list") { ... on Blob { text } }
    hooks: object(expression: "HEAD:claude/settings.json") { ... on Blob { text } }
    install: object(expression: "HEAD:rust/agent-config/src/dots/install/mod.rs") { ... on Blob { text } }
    guard: object(expression: "HEAD:rust/agent-config/src/guard_checks.rs") { ... on Blob { text } }
  }
}`;

const skillPattern = /^claude\/skills\/ps_[^/]+\/SKILL\.md$/u;
const agentPattern = /^claude\/agents\/(?!README\.md$)[^/]+\.md$/u;
const presetPattern = /^claude\/presets\/[^/]+\/rules\.md$/u;
const installPattern = /"(\d{2}-[\da-z-]+)"/gu;
const guardPattern = /"([GW]\d+|H1)"/gu;

const uniqueMatches = (source: string, pattern: RegExp): number =>
  new Set(source.matchAll(pattern).map((match) => match[1])).size;

const withoutTests = (source: string): string =>
  source.split("#[cfg(test)]", 1)[0] ?? "";

export const parseTree = (data: unknown): TreeEntry[] => {
  const tree = TreeSchema.parse(data);
  if (tree.truncated) throw new Error("tree truncated");
  return tree.tree;
};

export const countTree = (entries: TreeEntry[]): TreeCounts => {
  const paths = entries
    .filter((entry) => entry.type === "blob")
    .map((entry) => entry.path);
  return {
    agents: paths.filter((path) => agentPattern.test(path)).length,
    files: paths.length,
    homeFiles: paths.filter((path) => path.startsWith("home/")).length,
    presets: paths.filter((path) => presetPattern.test(path)).length,
    skillNames: paths
      .filter((path) => skillPattern.test(path))
      .map((path) => `ps:${path.split("/", 3)[2]?.slice(3) ?? ""}`)
      .toSorted((a, b) => a.localeCompare(b)),
    skills: paths.filter((path) => skillPattern.test(path)).length,
  };
};

export const parseBlobTexts = (data: unknown): BlobTexts => {
  const { guard, hooks, install, tools } =
    BlobTextsSchema.parse(data).data.repository;
  return {
    guard: guard.text,
    hooks: hooks.text,
    install: install.text,
    tools: tools.text,
  };
};

export const countTools = (text: string): number =>
  text.split("\n").filter((line) => /^[a-z]/iu.test(line)).length;

export const countHookEvents = (json: string): number =>
  Object.keys(HooksSchema.parse(JSON.parse(json)).hooks).length;

export const countInstallSteps = (source: string): number =>
  uniqueMatches(withoutTests(source), installPattern);

export const countGuardChecks = (source: string): number =>
  uniqueMatches(withoutTests(source), guardPattern);

export const rustShareOf = (languages: Record<string, number>): number => {
  const total = Object.values(languages).reduce((sum, bytes) => sum + bytes, 0);
  return total > 0 ? (languages["Rust"] ?? 0) / total : 0;
};

const mayBeZero: ReadonlySet<keyof DotfilesFacts> = new Set(["forks", "stars"]);

export const checkFacts = (facts: DotfilesFacts): DotfilesFacts => {
  for (const [name, value] of Object.entries(facts)) {
    if (value === 0 && !mayBeZero.has(name as keyof DotfilesFacts)) {
      throw new Error(`dotfiles fact ${name} is 0`);
    }
  }
  return facts;
};

export const getDotfilesFacts = async (
  fetchImpl: typeof fetch = fetch
): Promise<DotfilesFacts> => {
  const [repoData, treeData, languageData, blobData] = await Promise.all([
    request(repoPath, fetchImpl),
    request(`${repoPath}/git/trees/HEAD?recursive=1`, fetchImpl),
    request(`${repoPath}/languages`, fetchImpl),
    graph(blobsQuery, { name: repoName, owner }, fetchImpl),
  ]);
  const repo = RepoSchema.parse(repoData);
  const texts = parseBlobTexts(blobData);
  return checkFacts({
    ...countTree(parseTree(treeData)),
    forks: repo.forks_count,
    guardChecks: countGuardChecks(texts.guard),
    hookEvents: countHookEvents(texts.hooks),
    installSteps: countInstallSteps(texts.install),
    pushedAt: repo.pushed_at,
    rustShare: rustShareOf(LanguagesSchema.parse(languageData)),
    stars: repo.stargazers_count,
    tools: countTools(texts.tools),
  });
};
