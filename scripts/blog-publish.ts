import { appendFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";

import { readPostSources } from "../src/lib/blog/posts.ts";
import { goLiveAt } from "../src/lib/blog/schedule.ts";
import {
  answerStatus,
  origin,
  parseBuiltAt,
  postIndexNow,
  readBuildJson,
  summarize,
} from "./indexnow.ts";

const minuteMs = 60_000;
const unknownWindowMs = 120 * minuteMs;
const retryWindowMs = 120 * minuteMs;
const backOffAfterMs = 180 * minuteMs;
const pollIntervalMs = 20_000;
const pollLimitMs = 15 * minuteMs;
const hookTimeoutMs = 30_000;
const hookName = "CLOUDFLARE_DEPLOY_HOOK";

export type Outcome =
  | { due: string[]; kind: "backed-off" }
  | { due: string[]; kind: "dry-run" }
  | { due: string[]; kind: "published"; urls: string[] }
  | { kind: "idle" }
  | { kind: "retried"; slugs: string[]; urls: string[] };

export interface PostTiming {
  date: string;
  draft: boolean;
  slug: string;
}

export interface PublishDeps {
  builtAt: () => Promise<Date | undefined>;
  indexNow: (urls: string[]) => Promise<number>;
  log: (lines: string[]) => void;
  now: () => Date;
  postHook: () => Promise<void>;
  posts: () => PostTiming[];
  sleep: (ms: number) => Promise<void>;
  status: (url: string) => Promise<number | undefined>;
}

export interface PublishOptions {
  dryRun: boolean;
  failingSince?: Date | undefined;
  hasHook: boolean;
  pollIntervalMs: number;
  pollLimitMs: number;
}

export const duePosts = (
  posts: readonly PostTiming[],
  builtAt: Date | undefined,
  now: Date
): string[] => {
  const since = builtAt?.getTime() ?? now.getTime() - unknownWindowMs;
  return posts
    .filter((post) => {
      if (post.draft) return false;
      const live = goLiveAt(post.date).getTime();
      return live > since && live <= now.getTime();
    })
    .map((post) => post.slug)
    .toSorted((a, b) => a.localeCompare(b));
};

export const recentlyLive = (
  posts: readonly PostTiming[],
  builtAt: Date | undefined,
  now: Date
): string[] => {
  if (builtAt === undefined) return [];
  const since = now.getTime() - retryWindowMs;
  const until = Math.min(builtAt.getTime(), now.getTime());
  return posts
    .filter((post) => {
      if (post.draft) return false;
      const live = goLiveAt(post.date).getTime();
      return live > since && live <= until;
    })
    .map((post) => post.slug)
    .toSorted((a, b) => a.localeCompare(b));
};

export const shouldBackOff = (
  failingSince: Date | undefined,
  now: Date
): boolean =>
  failingSince !== undefined &&
  now.getTime() - failingSince.getTime() > backOffAfterMs;

export const announcedUrls = (slugs: readonly string[]): string[] => [
  ...slugs.map((slug) => `${origin}/blog/${slug}`),
  `${origin}/blog`,
  `${origin}/blog/feed.xml`,
  `${origin}/blog/feed.json`,
];

const waitForNewBuild = async (
  deps: PublishDeps,
  options: PublishOptions,
  since: Date
): Promise<void> => {
  const deadline = deps.now().getTime() + options.pollLimitMs;
  for (;;) {
    const live = await deps.builtAt();
    if (live !== undefined && live.getTime() > since.getTime()) return;
    if (deps.now().getTime() + options.pollIntervalMs > deadline) {
      throw new Error(
        `The live build did not move past ${since.toISOString()} within ${String(options.pollLimitMs / minuteMs)} minutes`
      );
    }
    await deps.sleep(options.pollIntervalMs);
  }
};

export const runPublish = async (
  deps: PublishDeps,
  options: PublishOptions
): Promise<Outcome> => {
  const now = deps.now();
  const builtAt = await deps.builtAt();
  const due = duePosts(deps.posts(), builtAt, now);
  const state =
    builtAt === undefined
      ? "the live build time is unknown, so the last two hours count"
      : `live build ${builtAt.toISOString()}`;
  if (due.length === 0) {
    const idle = `No scheduled post is due (${state}, checked ${now.toISOString()}).`;
    const recent = recentlyLive(deps.posts(), builtAt, now);
    const answers = await Promise.all(
      recent.map((slug) => deps.status(`${origin}/blog/${slug}`))
    );
    const slugs = recent.filter((_slug, index) => answers[index] === 200);
    if (slugs.length === 0) {
      deps.log([idle]);
      return { kind: "idle" };
    }
    const urls = announcedUrls(slugs);
    if (options.dryRun) {
      deps.log([
        idle,
        `Dry run: would tell IndexNow again about ${slugs.join(", ")}, which went live in the last two hours.`,
      ]);
      return { kind: "idle" };
    }
    const status = await deps.indexNow(urls);
    deps.log([
      idle,
      `Told IndexNow again about ${slugs.join(", ")}, live in the last two hours (${String(status)}):`,
      ...urls.map((url) => `- ${url}`),
    ]);
    return { kind: "retried", slugs, urls };
  }
  if (options.dryRun) {
    deps.log([
      `Dry run: ${String(due.length)} post(s) are due (${state}): ${due.join(", ")}.`,
      "Would call the deploy hook, wait for the new build, then tell IndexNow. Did none of it.",
    ]);
    return { due, kind: "dry-run" };
  }
  if (shouldBackOff(options.failingSince, now)) {
    deps.log([
      `Backed off: ${String(due.length)} post(s) are due (${due.join(", ")}), but the blog-publish-failed issue has been open since ${options.failingSince?.toISOString() ?? ""}. Not calling the deploy hook. Fix the cause, then run the workflow by hand.`,
    ]);
    return { due, kind: "backed-off" };
  }
  if (!options.hasHook) {
    throw new Error(
      `${hookName} is not set, but ${String(due.length)} post(s) are due: ${due.join(", ")}. Add the secret to the repository.`
    );
  }
  const triggeredAt = deps.now();
  await deps.postHook();
  deps.log([
    `Deploy hook called for ${due.join(", ")}. Waiting for a build newer than ${triggeredAt.toISOString()}.`,
  ]);
  await waitForNewBuild(deps, options, triggeredAt);
  const urls = announcedUrls(due);
  const status = await deps.indexNow(urls);
  deps.log([
    `The new build is live. IndexNow accepted ${String(urls.length)} URLs (${String(status)}):`,
    ...urls.map((url) => `- ${url}`),
  ]);
  return { due, kind: "published", urls };
};

const liveBuiltAt = async (): Promise<Date | undefined> => {
  const marker = await readBuildJson();
  if (marker.text === undefined) {
    process.stderr.write(`${marker.problem}\n`);
    return undefined;
  }
  const builtAt = parseBuiltAt(marker.text);
  if (builtAt === undefined) {
    process.stderr.write("build.json has no readable builtAt\n");
  }
  return builtAt;
};

const callHook = async (hook: string): Promise<void> => {
  let status: number;
  try {
    const response = await fetch(hook, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(hookTimeoutMs),
    });
    await response.body?.cancel();
    ({ status } = response);
  } catch {
    throw new Error("The deploy hook could not be reached");
  }
  if (status < 200 || status >= 300) {
    throw new Error(`The deploy hook answered ${String(status)}`);
  }
};

const parseSince = (text = ""): Date | undefined => {
  const value = text.trim();
  if (value === "") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const run = async (): Promise<void> => {
  const { values } = parseArgs({
    options: { "dry-run": { default: false, type: "boolean" } },
  });
  const hook = (process.env["CLOUDFLARE_DEPLOY_HOOK"] ?? "").trim();
  const outcome = await runPublish(
    {
      builtAt: liveBuiltAt,
      indexNow: postIndexNow,
      log: summarize,
      now: () => new Date(),
      postHook: () => callHook(hook),
      posts: () =>
        readPostSources().map(({ meta }) => ({
          date: meta.date,
          draft: meta.draft,
          slug: meta.slug,
        })),
      sleep: (ms) => sleep(ms),
      status: answerStatus,
    },
    {
      dryRun: values["dry-run"],
      failingSince: parseSince(process.env["FAILING_SINCE"]),
      hasHook: hook !== "",
      pollIntervalMs,
      pollLimitMs,
    }
  );
  const output = process.env["GITHUB_OUTPUT"];
  if (output !== undefined && output !== "" && outcome.kind === "backed-off") {
    appendFileSync(output, "backed_off=true\n");
  }
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
