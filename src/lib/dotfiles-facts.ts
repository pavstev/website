import * as z from "zod";

import { graph, request } from "./github.ts";

export interface BlobTexts {
  dotfilesCargo: string;
  guard: string;
  harnessCargo: string;
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

type HarnessCounts = Pick<
  DotfilesFacts,
  "agents" | "outputStyles" | "presets" | "skillNames" | "skills"
>;

const owner = "pavstev";
const dotfilesRepo = "dotfiles";
const harnessRepo = "tackroom";
const plugin = "plugins/ps";
const crate = "crates/agent-config";

const treePath = (repo: string): string =>
  `/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`;

const TreeEntrySchema = z.object({ path: z.string(), type: z.string() });

const TreeSchema = z.object({
  tree: z.array(TreeEntrySchema),
  truncated: z.boolean(),
});

const blobText = z.object({ text: z.string() });

const BlobTextsSchema = z.object({
  data: z.object({
    dotfiles: z.object({ cargo: blobText }),
    harness: z.object({ cargo: blobText, guard: blobText, hooks: blobText }),
  }),
});

const HooksSchema = z.object({ hooks: z.record(z.string(), z.unknown()) });

const blob = (name: string, path: string): string =>
  `${name}: object(expression: "HEAD:${path}") { ... on Blob { text } }`;

const blobsQuery = `query {
  dotfiles: repository(owner: "${owner}", name: "${dotfilesRepo}") {
    ${blob("cargo", "rust/agent-config/Cargo.toml")}
  }
  harness: repository(owner: "${owner}", name: "${harnessRepo}") {
    ${blob("hooks", `${plugin}/hooks/hooks.json`)}
    ${blob("guard", `${crate}/src/guard_checks.rs`)}
    ${blob("cargo", `${crate}/Cargo.toml`)}
  }
}`;

const skillPattern = /^plugins\/ps\/skills\/([^/]+)\/SKILL\.md$/u;
const agentPattern = /^plugins\/ps\/agents\/(?!README\.md$)[^/]+\.md$/u;
const presetPattern = /^plugins\/ps\/presets\/[^/]+\/rules\.md$/u;
const outputStylePattern =
  /^plugins\/ps\/output-styles\/(?!README\.md$)[^/]+\.md$/u;
const guardPattern = /"([GW]\d+|H1)"/gu;
const binNamePattern = /^\s*name\s*=\s*"([^"]+)"/mu;

const uniqueMatches = (source: string, pattern: RegExp): number =>
  new Set(source.matchAll(pattern).map((match) => match[1])).size;

const withoutTests = (source: string): string =>
  source.split("#[cfg(test)]", 1)[0] ?? "";

const blobPaths = (entries: TreeEntry[]): string[] =>
  entries.filter((entry) => entry.type === "blob").map((entry) => entry.path);

export const parseTree = (data: unknown): TreeEntry[] => {
  const tree = TreeSchema.parse(data);
  if (tree.truncated) throw new Error("tree truncated");
  return tree.tree;
};

export const countHomeFiles = (entries: TreeEntry[]): number =>
  blobPaths(entries).filter((path) => path.startsWith("home/")).length;

export const countHarness = (entries: TreeEntry[]): HarnessCounts => {
  const paths = blobPaths(entries);
  const skillNames = paths
    .map((path) => skillPattern.exec(path)?.[1])
    .filter((name) => name !== undefined)
    .map((name) => `ps:${name}`)
    .toSorted((a, b) => a.localeCompare(b));
  return {
    agents: paths.filter((path) => agentPattern.test(path)).length,
    outputStyles: paths.filter((path) => outputStylePattern.test(path)).length,
    presets: paths.filter((path) => presetPattern.test(path)).length,
    skillNames,
    skills: skillNames.length,
  };
};

export const parseBlobTexts = (data: unknown): BlobTexts => {
  const { dotfiles, harness } = BlobTextsSchema.parse(data).data;
  return {
    dotfilesCargo: dotfiles.cargo.text,
    guard: harness.guard.text,
    harnessCargo: harness.cargo.text,
    hooks: harness.hooks.text,
  };
};

export const countHookEvents = (json: string): number =>
  Object.keys(HooksSchema.parse(JSON.parse(json)).hooks).length;

export const countGuardChecks = (source: string): number =>
  uniqueMatches(withoutTests(source), guardPattern);

export const countRustPrograms = (...manifests: string[]): number =>
  new Set(
    manifests.flatMap((cargo) =>
      cargo
        .split(/^\s*\[\[/mu)
        .filter((section) => section.startsWith("bin]]"))
        .map((section) => binNamePattern.exec(section)?.[1])
        .filter((name) => name !== undefined)
    )
  ).size;

export const checkFacts = (facts: DotfilesFacts): DotfilesFacts => {
  for (const [name, value] of Object.entries(facts)) {
    if (value === 0) throw new Error(`dotfiles fact ${name} is 0`);
  }
  return facts;
};

export const getDotfilesFacts = async (
  fetchImpl: typeof fetch = fetch
): Promise<DotfilesFacts> => {
  const [dotfilesTree, harnessTree, blobData] = await Promise.all([
    request(treePath(dotfilesRepo), fetchImpl),
    request(treePath(harnessRepo), fetchImpl),
    graph(blobsQuery, {}, fetchImpl),
  ]);
  const texts = parseBlobTexts(blobData);
  return checkFacts({
    ...countHarness(parseTree(harnessTree)),
    guardChecks: countGuardChecks(texts.guard),
    homeFiles: countHomeFiles(parseTree(dotfilesTree)),
    hookEvents: countHookEvents(texts.hooks),
    rustPrograms: countRustPrograms(texts.dotfilesCargo, texts.harnessCargo),
  });
};
