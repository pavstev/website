import * as z from "zod";

import { graph, request } from "./github.ts";

export interface BlobTexts {
  cargo: string;
  guard: string;
  hooks: string;
}

export interface DotfilesFacts {
  agents: number;
  guardChecks: number;
  homeFiles: number;
  hookEvents: number;
  outputStyles: number;
  presets: number;
  rustPrograms: number;
  skillNames: string[];
  skills: number;
}

export interface TreeEntry {
  path: string;
  type: string;
}

type TreeCounts = Pick<
  DotfilesFacts,
  "agents" | "homeFiles" | "outputStyles" | "presets" | "skillNames" | "skills"
>;

const owner = "pavstev";
const repoName = "dotfiles";
const repoPath = `/repos/${owner}/${repoName}`;
const repoVariables = { name: repoName, owner };

const TreeEntrySchema = z.object({ path: z.string(), type: z.string() });

const TreeSchema = z.object({
  tree: z.array(TreeEntrySchema),
  truncated: z.boolean(),
});

const blobText = z.object({ text: z.string() });

const BlobTextsSchema = z.object({
  data: z.object({
    repository: z.object({
      cargo: blobText,
      guard: blobText,
      hooks: blobText,
    }),
  }),
});

const HooksSchema = z.object({ hooks: z.record(z.string(), z.unknown()) });

const blobsQuery = `query ($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    hooks: object(expression: "HEAD:claude/settings.json") { ... on Blob { text } }
    guard: object(expression: "HEAD:rust/agent-config/src/guard_checks.rs") { ... on Blob { text } }
    cargo: object(expression: "HEAD:rust/agent-config/Cargo.toml") { ... on Blob { text } }
  }
}`;

const skillPattern = /^claude\/skills\/ps_[^/]+\/SKILL\.md$/u;
const agentPattern = /^claude\/agents\/(?!README\.md$)[^/]+\.md$/u;
const presetPattern = /^claude\/presets\/[^/]+\/rules\.md$/u;
const outputStylePattern = /^claude\/output-styles\/(?!README\.md$)[^/]+\.md$/u;
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
  const skillNames = paths
    .filter((path) => skillPattern.test(path))
    .map((path) => `ps:${path.split("/", 3)[2]?.slice(3) ?? ""}`)
    .toSorted((a, b) => a.localeCompare(b));
  return {
    agents: paths.filter((path) => agentPattern.test(path)).length,
    homeFiles: paths.filter((path) => path.startsWith("home/")).length,
    outputStyles: paths.filter((path) => outputStylePattern.test(path)).length,
    presets: paths.filter((path) => presetPattern.test(path)).length,
    skillNames,
    skills: skillNames.length,
  };
};

export const parseBlobTexts = (data: unknown): BlobTexts => {
  const { cargo, guard, hooks } = BlobTextsSchema.parse(data).data.repository;
  return { cargo: cargo.text, guard: guard.text, hooks: hooks.text };
};

export const countHookEvents = (json: string): number =>
  Object.keys(HooksSchema.parse(JSON.parse(json)).hooks).length;

export const countGuardChecks = (source: string): number =>
  uniqueMatches(withoutTests(source), guardPattern);

export const countRustPrograms = (cargo: string): number =>
  cargo.split("\n").filter((line) => line.trim() === "[[bin]]").length;

export const checkFacts = (facts: DotfilesFacts): DotfilesFacts => {
  for (const [name, value] of Object.entries(facts)) {
    if (value === 0) throw new Error(`dotfiles fact ${name} is 0`);
  }
  return facts;
};

export const getDotfilesFacts = async (
  fetchImpl: typeof fetch = fetch
): Promise<DotfilesFacts> => {
  const [treeData, blobData] = await Promise.all([
    request(`${repoPath}/git/trees/HEAD?recursive=1`, fetchImpl),
    graph(blobsQuery, repoVariables, fetchImpl),
  ]);
  const texts = parseBlobTexts(blobData);
  return checkFacts({
    ...countTree(parseTree(treeData)),
    guardChecks: countGuardChecks(texts.guard),
    hookEvents: countHookEvents(texts.hooks),
    rustPrograms: countRustPrograms(texts.cargo),
  });
};
