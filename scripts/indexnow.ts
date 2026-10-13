import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";

const host = "stevanpavlovic.com";
const origin = `https://${host}`;
const key = "ee32ef309c036fb4c6b716d08e9bf922";
const endpoint = "https://api.indexnow.org/IndexNow";
const pollIntervalMs = 20_000;
const pollLimitMs = 15 * 60_000;
const requestTimeoutMs = 15_000;
const slugPattern = /^content\/blog\/([a-z0-9][a-z0-9-]*)\/[^/]/u;
const shaPattern = /^[0-9a-f]{40}$/u;
const commitSuffix = "^{commit}";
const emptySha = "0".repeat(40);

export const changedSlugs = (paths: string[]): string[] => {
  const slugs = new Set<string>();
  for (const line of paths) {
    const slug = slugPattern.exec(line.trim())?.[1];
    if (slug !== undefined) slugs.add(slug);
  }
  return [...slugs];
};

export const indexNowBody = (
  urls: string[]
): {
  host: "stevanpavlovic.com";
  key: "ee32ef309c036fb4c6b716d08e9bf922";
  keyLocation: "https://stevanpavlovic.com/ee32ef309c036fb4c6b716d08e9bf922.txt";
  urlList: string[];
} => ({
  host,
  key,
  keyLocation: `${origin}/${key}.txt`,
  urlList: urls,
});

export const parseBuildSha = (text: string): string | undefined => {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const { sha } = parsed as { sha?: unknown };
    return typeof sha === "string" && shaPattern.test(sha) ? sha : undefined;
  } catch {
    return undefined;
  }
};

export const isIndexNowAccepted = (status: number): boolean =>
  status === 200 || status === 202;

const git = (args: string[]): string =>
  execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

const gitSucceeds = (args: string[]): boolean => {
  try {
    git(args);
    return true;
  } catch {
    return false;
  }
};

const isAncestor = (sha: string, live: string): boolean => {
  if (gitSucceeds(["merge-base", "--is-ancestor", sha, live])) return true;
  if (gitSucceeds(["cat-file", "-e", `${live}${commitSuffix}`])) return false;
  gitSucceeds(["fetch", "--quiet", "origin", "main"]);
  return gitSucceeds(["merge-base", "--is-ancestor", sha, live]);
};

type Live = { problem: string; sha?: undefined } | { sha: string };

const readLive = async (): Promise<Live> => {
  try {
    const response = await fetch(`${origin}/build.json`, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    if (response.status !== 200) {
      return { problem: `build.json answered ${String(response.status)}` };
    }
    const sha = parseBuildSha(await response.text());
    return sha === undefined
      ? {
          problem:
            "build.json is not a marker with a full 40 character commit in sha",
        }
      : { sha };
  } catch (error) {
    return {
      problem: `build.json could not be read (${error instanceof Error ? error.message : String(error)})`,
    };
  }
};

const waitForDeploy = async (
  sha: string
): Promise<{ ok: boolean; problem: string }> => {
  const deadline = Date.now() + pollLimitMs;
  let problem = "no answer yet";
  for (;;) {
    const live = await readLive();
    if (live.sha === undefined) {
      ({ problem } = live);
    } else if (live.sha === sha || isAncestor(sha, live.sha)) {
      return { ok: true, problem: "" };
    } else {
      problem = `the live build is ${live.sha}`;
    }
    if (Date.now() + pollIntervalMs > deadline) return { ok: false, problem };
    await sleep(pollIntervalMs);
  }
};

export type GitRunner = (args: string[]) => string;

export const changedPaths = (
  before: string,
  sha: string,
  run: GitRunner = git
): string[] => {
  const parent = `${sha}^`;
  const bases =
    before === emptySha || !shaPattern.test(before)
      ? [parent]
      : [before, parent];
  for (const base of bases) {
    try {
      return run(["diff", "--name-only", base, sha]).split("\n");
    } catch {
      continue;
    }
  }
  try {
    return run([
      "diff-tree",
      "--root",
      "--no-commit-id",
      "--name-only",
      "-r",
      sha,
    ]).split("\n");
  } catch {
    throw new Error("Could not list the files this push changed");
  }
};

export const indexNowError = (status: number, body: string): string => {
  const hints = new Map([
    [422, "the URLs do not belong to the host, or the key file does not match"],
    [429, "too many requests; wait before trying again"],
  ]);
  const hint = hints.get(status);
  const text = body.trim().slice(0, 300);
  return [
    `IndexNow answered ${String(status)}`,
    ...(hint === undefined ? [] : [` (${hint})`]),
    text === "" ? "" : `: ${text}`,
  ].join("");
};

const answersOk = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    await response.body?.cancel();
    return response.status === 200;
  } catch {
    return false;
  }
};

const summarize = (lines: string[]): void => {
  const text = lines.join("\n");
  process.stdout.write(`${text}\n`);
  const file = process.env["GITHUB_STEP_SUMMARY"];
  if (file !== undefined && file !== "") appendFileSync(file, `${text}\n`);
};

const run = async (): Promise<void> => {
  const { values } = parseArgs({
    options: { before: { type: "string" }, sha: { type: "string" } },
  });
  const { before, sha } = values;
  if (sha === undefined || !shaPattern.test(sha)) {
    throw new Error("Pass --sha <40 character commit>");
  }
  if (before === undefined) throw new Error("Pass --before <commit>");

  const slugs = changedSlugs(changedPaths(before, sha));
  if (slugs.length === 0) {
    summarize(["No post folder changed. Nothing to tell IndexNow."]);
    return;
  }

  const deploy = await waitForDeploy(sha);
  if (!deploy.ok) {
    throw new Error(
      `The live site did not reach ${sha} within ${String(pollLimitMs / 60_000)} minutes (last state: ${deploy.problem})`
    );
  }

  const candidates = slugs.map((slug) => `${origin}/blog/${slug}`);
  const answers = await Promise.all(candidates.map((url) => answersOk(url)));
  const posts = candidates.filter((_url, index) => answers[index] === true);
  const skipped = candidates.filter((_url, index) => answers[index] !== true);
  const urls = [...posts, `${origin}/blog`, `${origin}/blog/feed.xml`];

  const response = await fetch(endpoint, {
    body: JSON.stringify(indexNowBody(urls)),
    headers: { "Content-Type": "application/json; charset=utf-8" },
    method: "POST",
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  if (!isIndexNowAccepted(response.status)) {
    let body = "";
    try {
      body = await response.text();
    } catch {
      body = "";
    }
    throw new Error(indexNowError(response.status, body));
  }

  summarize([
    `IndexNow accepted ${String(urls.length)} URLs (${String(response.status)}):`,
    ...urls.map((url) => `- ${url}`),
    ...(skipped.length === 0
      ? []
      : [
          "Skipped, as they did not answer 200 (deleted or still a draft):",
          ...skipped.map((url) => `- ${url}`),
        ]),
  ]);
};

if (import.meta.main) {
  try {
    await run();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  }
}
