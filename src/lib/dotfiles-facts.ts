import * as z from "zod";

import { graph, request } from "./github.ts";

export interface BlobTexts {
  cargo: string;
  doctor: string;
  guard: string;
  hooks: string;
  install: string;
  readme: string;
  tools: string;
}

export interface DotfilesFacts {
  agents: number;
  distros: number;
  doctorChecks: number;
  files: number;
  forks: number;
  guardChecks: number;
  homeFiles: number;
  hookEvents: number;
  installSteps: number;
  outputStyles: number;
  presets: number;
  pushedAt: string;
  rustPrograms: number;
  rustShare: number;
  skillNames: string[];
  skills: number;
  stars: number;
  tests: number;
  tools: number;
}

export interface TreeEntry {
  path: string;
  type: string;
}

type TreeCounts = Pick<
  DotfilesFacts,
  | "agents"
  | "files"
  | "homeFiles"
  | "outputStyles"
  | "presets"
  | "skillNames"
  | "skills"
>;

const owner = "pavstev";
const repoName = "dotfiles";
const repoPath = `/repos/${owner}/${repoName}`;
const repoVariables = { name: repoName, owner };

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
      cargo: blobText,
      doctor: blobText,
      guard: blobText,
      hooks: blobText,
      install: blobText,
      readme: blobText,
      tools: blobText,
    }),
  }),
});

const SourceSchema = z.object({
  isTruncated: z.literal(false),
  text: z.string(),
});

const SourceMapSchema = z.record(z.string(), SourceSchema);

const SourcesSchema = z.object({
  data: z.object({ repository: SourceMapSchema }),
});

const HooksSchema = z.object({ hooks: z.record(z.string(), z.unknown()) });

const blobsQuery = `query ($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    tools: object(expression: "HEAD:tools.list") { ... on Blob { text } }
    hooks: object(expression: "HEAD:claude/settings.json") { ... on Blob { text } }
    install: object(expression: "HEAD:rust/agent-config/src/dots/install/mod.rs") { ... on Blob { text } }
    guard: object(expression: "HEAD:rust/agent-config/src/guard_checks.rs") { ... on Blob { text } }
    cargo: object(expression: "HEAD:rust/agent-config/Cargo.toml") { ... on Blob { text } }
    readme: object(expression: "HEAD:README.md") { ... on Blob { text } }
    doctor: object(expression: "HEAD:rust/agent-config/src/dots/doctor.rs") { ... on Blob { text } }
  }
}`;

const skillPattern = /^claude\/skills\/ps_[^/]+\/SKILL\.md$/u;
const agentPattern = /^claude\/agents\/(?!README\.md$)[^/]+\.md$/u;
const presetPattern = /^claude\/presets\/[^/]+\/rules\.md$/u;
const outputStylePattern = /^claude\/output-styles\/(?!README\.md$)[^/]+\.md$/u;
const rustSourcePattern = /^rust\/(?!.*\/fixtures\/).+\.rs$/u;
const testPattern = /^\s*#\[test\]/gmu;
const doctorPattern = /^\s*c\("([\da-z-]+)",/gmu;
const linuxPattern = /\*\*Linux\*\* \(([^)]+)\)/u;
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
    outputStyles: paths.filter((path) => outputStylePattern.test(path)).length,
    presets: paths.filter((path) => presetPattern.test(path)).length,
    skillNames: paths
      .filter((path) => skillPattern.test(path))
      .map((path) => `ps:${path.split("/", 3)[2]?.slice(3) ?? ""}`)
      .toSorted((a, b) => a.localeCompare(b)),
    skills: paths.filter((path) => skillPattern.test(path)).length,
  };
};

export const rustSources = (entries: TreeEntry[]): string[] =>
  entries
    .filter((entry) => entry.type === "blob")
    .map((entry) => entry.path)
    .filter((path) => rustSourcePattern.test(path));

export const sourcesQuery = (paths: string[]): string => {
  const fields = paths.map(
    (path, index) =>
      `    s${String(index)}: object(expression: ${JSON.stringify(`HEAD:${path}`)}) { ... on Blob { text isTruncated } }`
  );
  return `query ($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
${fields.join("\n")}
  }
}`;
};

export const parseSources = (data: unknown, paths: string[]): string[] => {
  const { repository } = SourcesSchema.parse(data).data;
  return paths.map((path, index) => {
    const source = repository[`s${String(index)}`];
    if (!source) throw new Error(`missing source ${path}`);
    return source.text;
  });
};

export const parseBlobTexts = (data: unknown): BlobTexts => {
  const { cargo, doctor, guard, hooks, install, readme, tools } =
    BlobTextsSchema.parse(data).data.repository;
  return {
    cargo: cargo.text,
    doctor: doctor.text,
    guard: guard.text,
    hooks: hooks.text,
    install: install.text,
    readme: readme.text,
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

export const countRustPrograms = (cargo: string): number =>
  cargo.split("\n").filter((line) => line.trim() === "[[bin]]").length;

export const countTests = (sources: string[]): number =>
  sources.reduce(
    (sum, source) => sum + (source.match(testPattern)?.length ?? 0),
    0
  );

export const countDoctorChecks = (source: string): number =>
  uniqueMatches(withoutTests(source), doctorPattern);

export const countDistros = (readme: string): number =>
  (linuxPattern.exec(readme)?.[1] ?? "")
    .split(",")
    .filter((name) => name.trim().length > 0).length;

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
    graph(blobsQuery, repoVariables, fetchImpl),
  ]);
  const entries = parseTree(treeData);
  const paths = rustSources(entries);
  const sources = parseSources(
    await graph(sourcesQuery(paths), repoVariables, fetchImpl),
    paths
  );
  const repo = RepoSchema.parse(repoData);
  const texts = parseBlobTexts(blobData);
  return checkFacts({
    ...countTree(entries),
    distros: countDistros(texts.readme),
    doctorChecks: countDoctorChecks(texts.doctor),
    forks: repo.forks_count,
    guardChecks: countGuardChecks(texts.guard),
    hookEvents: countHookEvents(texts.hooks),
    installSteps: countInstallSteps(texts.install),
    pushedAt: repo.pushed_at,
    rustPrograms: countRustPrograms(texts.cargo),
    rustShare: rustShareOf(LanguagesSchema.parse(languageData)),
    stars: repo.stargazers_count,
    tests: countTests(sources),
    tools: countTools(texts.tools),
  });
};
