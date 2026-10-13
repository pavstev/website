import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  announcedUrls,
  duePosts,
  type Outcome,
  type PostTiming,
  type PublishDeps,
  type PublishOptions,
  recentlyLive,
  runPublish,
  shouldBackOff,
} from "./blog-publish.ts";

const post = (slug: string, date: string, draft = false): PostTiming => ({
  date,
  draft,
  slug,
});

describe("duePosts", () => {
  const built = new Date("2026-10-13T12:03:56.892Z");

  it("takes posts whose Vienna midnight is after the live build and not after now", () => {
    const now = new Date("2026-10-14T08:07:00Z");
    assert.deepEqual(
      duePosts(
        [
          post("old", "2026-10-13"),
          post("today", "2026-10-14"),
          post("later", "2026-10-15"),
        ],
        built,
        now
      ),
      ["today"]
    );
  });

  it("is half open: a post at exactly the build time is not due, one at now is", () => {
    const live = new Date("2026-10-13T22:00:00Z");
    assert.deepEqual(
      duePosts(
        [post("a", "2026-10-14")],
        live,
        new Date("2026-10-14T05:00:00Z")
      ),
      []
    );
    assert.deepEqual(
      duePosts(
        [post("a", "2026-10-14")],
        new Date("2026-10-13T21:59:59Z"),
        live
      ),
      ["a"]
    );
  });

  it("skips drafts", () => {
    assert.deepEqual(
      duePosts(
        [post("hidden", "2026-10-14", true)],
        built,
        new Date("2026-10-14T08:07:00Z")
      ),
      []
    );
  });

  it("sorts the slugs and lists every post that went live since the build", () => {
    assert.deepEqual(
      duePosts(
        [
          post("b", "2026-10-14"),
          post("a", "2026-10-14"),
          post("c", "2026-10-13"),
        ],
        new Date("2026-10-12T10:00:00Z"),
        new Date("2026-10-14T08:07:00Z")
      ),
      ["a", "b", "c"]
    );
  });

  it("uses the Vienna midnight across the spring clock change", () => {
    const before = new Date("2026-03-28T22:30:00Z");
    assert.deepEqual(
      duePosts(
        [post("dst", "2026-03-29")],
        new Date("2026-03-28T12:00:00Z"),
        before
      ),
      []
    );
    assert.deepEqual(
      duePosts(
        [post("dst", "2026-03-29")],
        new Date("2026-03-28T12:00:00Z"),
        new Date("2026-03-28T23:07:00Z")
      ),
      ["dst"]
    );
    assert.deepEqual(
      duePosts(
        [post("after", "2026-03-30")],
        new Date("2026-03-29T12:00:00Z"),
        new Date("2026-03-29T22:07:00Z")
      ),
      ["after"]
    );
  });

  it("uses the Vienna midnight across the autumn clock change", () => {
    assert.deepEqual(
      duePosts(
        [post("fall", "2026-10-25")],
        new Date("2026-10-24T12:00:00Z"),
        new Date("2026-10-24T21:07:00Z")
      ),
      []
    );
    assert.deepEqual(
      duePosts(
        [post("fall", "2026-10-25")],
        new Date("2026-10-24T12:00:00Z"),
        new Date("2026-10-24T22:07:00Z")
      ),
      ["fall"]
    );
    assert.deepEqual(
      duePosts(
        [post("after", "2026-10-26")],
        new Date("2026-10-25T12:00:00Z"),
        new Date("2026-10-25T23:07:00Z")
      ),
      ["after"]
    );
  });

  it("looks back two hours when the live build time is unknown", () => {
    const now = new Date("2026-10-13T23:30:00Z");
    assert.deepEqual(
      duePosts(
        [post("recent", "2026-10-14"), post("ancient", "2026-10-10")],
        undefined,
        now
      ),
      ["recent"]
    );
    assert.deepEqual(
      duePosts(
        [post("recent", "2026-10-14")],
        undefined,
        new Date("2026-10-14T01:00:00Z")
      ),
      []
    );
  });
});

describe("recentlyLive", () => {
  const built = new Date("2026-10-13T22:30:00Z");
  const now = new Date("2026-10-13T23:07:00Z");

  it("takes posts that went live in the last two hours and are in the live build", () => {
    assert.deepEqual(
      recentlyLive(
        [
          post("fresh", "2026-10-14"),
          post("yesterday", "2026-10-13"),
          post("later", "2026-10-15"),
        ],
        built,
        now
      ),
      ["fresh"]
    );
  });

  it("leaves out posts whose go-live is after the live build", () => {
    assert.deepEqual(
      recentlyLive(
        [post("fresh", "2026-10-14")],
        new Date("2026-10-13T21:00:00Z"),
        now
      ),
      []
    );
  });

  it("skips drafts", () => {
    assert.deepEqual(
      recentlyLive([post("hidden", "2026-10-14", true)], built, now),
      []
    );
  });

  it("stops at two hours", () => {
    assert.deepEqual(
      recentlyLive(
        [post("fresh", "2026-10-14")],
        new Date("2026-10-14T10:30:00Z"),
        new Date("2026-10-14T10:07:00Z")
      ),
      []
    );
    assert.deepEqual(
      recentlyLive(
        [post("fresh", "2026-10-14")],
        new Date("2026-10-14T10:30:00Z"),
        new Date("2026-10-14T00:07:00Z")
      ),
      []
    );
  });

  it("is empty when the live build time is unknown", () => {
    assert.deepEqual(
      recentlyLive([post("fresh", "2026-10-14")], undefined, now),
      []
    );
  });
});

describe("shouldBackOff", () => {
  const now = new Date("2026-10-14T08:07:00Z");

  it("is false with no open failure issue", () => {
    assert.equal(shouldBackOff(undefined, now), false);
  });

  it("is false while the issue is three hours old or less", () => {
    assert.equal(shouldBackOff(new Date("2026-10-14T05:07:00Z"), now), false);
    assert.equal(shouldBackOff(new Date("2026-10-14T07:00:00Z"), now), false);
  });

  it("is true once the issue is older than three hours", () => {
    assert.equal(shouldBackOff(new Date("2026-10-14T05:06:59Z"), now), true);
  });
});

describe("announcedUrls", () => {
  it("lists the posts, the index and both feeds", () => {
    assert.deepEqual(announcedUrls(["a", "b"]), [
      "https://stevanpavlovic.com/blog/a",
      "https://stevanpavlovic.com/blog/b",
      "https://stevanpavlovic.com/blog",
      "https://stevanpavlovic.com/blog/feed.xml",
      "https://stevanpavlovic.com/blog/feed.json",
    ]);
  });
});

interface Calls {
  hook: number;
  indexNow: string[][];
  logs: string[];
  sleeps: number;
  statuses: string[];
}

const fakes = (
  overrides: {
    builtAt?: (calls: Calls, clock: { ms: number }) => Date | undefined;
    posts?: PostTiming[];
    start?: string;
    status?: number | undefined;
  } = {}
): { calls: Calls; deps: PublishDeps } => {
  const calls: Calls = {
    hook: 0,
    indexNow: [],
    logs: [],
    sleeps: 0,
    statuses: [],
  };
  const clock = { ms: Date.parse(overrides.start ?? "2026-10-14T08:07:00Z") };
  const builtAt =
    overrides.builtAt ??
    ((state, time): Date =>
      new Date(state.hook === 0 ? "2026-10-13T12:00:00Z" : time.ms));
  return {
    calls,
    deps: {
      builtAt: () => Promise.resolve(builtAt(calls, clock)),
      indexNow: (urls) => {
        calls.indexNow.push(urls);
        return Promise.resolve(200);
      },
      log: (lines) => {
        calls.logs.push(...lines);
      },
      now: () => new Date(clock.ms),
      postHook: () => {
        calls.hook += 1;
        return Promise.resolve();
      },
      posts: () => overrides.posts ?? [post("fresh", "2026-10-14")],
      sleep: (ms) => {
        calls.sleeps += 1;
        clock.ms += ms;
        return Promise.resolve();
      },
      status: (url) => {
        calls.statuses.push(url);
        return Promise.resolve("status" in overrides ? overrides.status : 200);
      },
    },
  };
};

const options: PublishOptions = {
  dryRun: false,
  hasHook: true,
  pollIntervalMs: 20_000,
  pollLimitMs: 15 * 60_000,
};

describe("runPublish", () => {
  it("does nothing and says so when no post is due", async () => {
    const { calls, deps } = fakes({ posts: [post("old", "2026-10-10")] });
    const outcome = await runPublish(deps, options);
    assert.deepEqual(outcome, { kind: "idle" });
    assert.equal(calls.hook, 0);
    assert.equal(calls.indexNow.length, 0);
    assert.equal(calls.logs.length, 1);
    assert.match(calls.logs[0] ?? "", /No scheduled post is due/);
  });

  it("needs no secret when nothing is due", async () => {
    const { deps } = fakes({ posts: [] });
    const outcome = await runPublish(deps, { ...options, hasHook: false });
    assert.equal(outcome.kind, "idle");
  });

  it("fails with a clear message when a post is due and the secret is missing", async () => {
    const { calls, deps } = fakes();
    await assert.rejects(
      runPublish(deps, { ...options, hasHook: false }),
      /CLOUDFLARE_DEPLOY_HOOK is not set, but 1 post\(s\) are due: fresh/
    );
    assert.equal(calls.hook, 0);
  });

  it("calls neither the hook nor IndexNow in a dry run", async () => {
    const { calls, deps } = fakes();
    const outcome = await runPublish(deps, {
      ...options,
      dryRun: true,
      hasHook: false,
    });
    assert.deepEqual(outcome, { due: ["fresh"], kind: "dry-run" });
    assert.equal(calls.hook, 0);
    assert.equal(calls.indexNow.length, 0);
    assert.match(calls.logs.join("\n"), /Dry run: 1 post\(s\) are due/);
  });

  it("calls the hook, waits for a newer build, then tells IndexNow", async () => {
    let polls = 0;
    const { calls, deps } = fakes({
      builtAt: (state, time) => {
        if (state.hook === 0) return new Date("2026-10-13T12:00:00Z");
        polls += 1;
        return new Date(polls < 3 ? "2026-10-14T08:00:00Z" : time.ms);
      },
    });
    const outcome = await runPublish(deps, options);
    assert.equal(outcome.kind, "published");
    assert.equal(calls.hook, 1);
    assert.equal(calls.sleeps, 2);
    assert.deepEqual(calls.indexNow, [announcedUrls(["fresh"])]);
  });

  it("throws and skips IndexNow when the build never moves", async () => {
    const { calls, deps } = fakes({
      builtAt: () => new Date("2026-10-13T12:00:00Z"),
    });
    await assert.rejects(runPublish(deps, options), /did not move past/);
    assert.equal(calls.hook, 1);
    assert.equal(calls.indexNow.length, 0);
    assert.ok(calls.sleeps > 10);
  });

  it("keeps waiting while the live build time cannot be read", async () => {
    let polls = 0;
    const { calls, deps } = fakes({
      builtAt: (state, time) => {
        if (state.hook === 0) return new Date("2026-10-13T12:00:00Z");
        polls += 1;
        return polls < 2 ? undefined : new Date(time.ms);
      },
    });
    const outcome: Outcome = await runPublish(deps, options);
    assert.equal(outcome.kind, "published");
    assert.equal(calls.sleeps, 1);
  });

  it("passes on a hook failure without waiting or telling IndexNow", async () => {
    const { calls, deps } = fakes();
    await assert.rejects(
      runPublish(
        {
          ...deps,
          postHook: () =>
            Promise.reject(new Error("The deploy hook answered 500")),
        },
        options
      ),
      /answered 500/
    );
    assert.equal(calls.sleeps, 0);
    assert.equal(calls.indexNow.length, 0);
  });

  it("tells IndexNow again about a post that went live in the last two hours", async () => {
    const { calls, deps } = fakes({
      builtAt: () => new Date("2026-10-13T22:30:00Z"),
      posts: [post("fresh", "2026-10-14"), post("old", "2026-10-10")],
      start: "2026-10-13T23:07:00Z",
    });
    const outcome = await runPublish(deps, options);
    assert.deepEqual(outcome, {
      kind: "retried",
      slugs: ["fresh"],
      urls: announcedUrls(["fresh"]),
    });
    assert.equal(calls.hook, 0);
    assert.deepEqual(calls.statuses, ["https://stevanpavlovic.com/blog/fresh"]);
    assert.deepEqual(calls.indexNow, [announcedUrls(["fresh"])]);
  });

  it("does not retry a post whose page does not answer 200", async () => {
    const { calls, deps } = fakes({
      builtAt: () => new Date("2026-10-13T22:30:00Z"),
      posts: [post("fresh", "2026-10-14")],
      start: "2026-10-13T23:07:00Z",
      status: 404,
    });
    const outcome = await runPublish(deps, options);
    assert.deepEqual(outcome, { kind: "idle" });
    assert.equal(calls.indexNow.length, 0);
  });

  it("does not retry in a dry run", async () => {
    const { calls, deps } = fakes({
      builtAt: () => new Date("2026-10-13T22:30:00Z"),
      posts: [post("fresh", "2026-10-14")],
      start: "2026-10-13T23:07:00Z",
    });
    const outcome = await runPublish(deps, { ...options, dryRun: true });
    assert.deepEqual(outcome, { kind: "idle" });
    assert.equal(calls.indexNow.length, 0);
    assert.match(calls.logs.join("\n"), /Dry run: would tell IndexNow again/);
  });

  it("lets a failed retry fail the run", async () => {
    const { deps } = fakes({
      builtAt: () => new Date("2026-10-13T22:30:00Z"),
      posts: [post("fresh", "2026-10-14")],
      start: "2026-10-13T23:07:00Z",
    });
    await assert.rejects(
      runPublish(
        {
          ...deps,
          indexNow: () => Promise.reject(new Error("IndexNow answered 429")),
        },
        options
      ),
      /429/
    );
  });

  it("skips the hook and logs one line when the failure issue is older than three hours", async () => {
    const { calls, deps } = fakes();
    const outcome = await runPublish(deps, {
      ...options,
      failingSince: new Date("2026-10-14T04:00:00Z"),
    });
    assert.deepEqual(outcome, { due: ["fresh"], kind: "backed-off" });
    assert.equal(calls.hook, 0);
    assert.equal(calls.indexNow.length, 0);
    assert.equal(calls.logs.length, 1);
    assert.match(calls.logs[0] ?? "", /Backed off: 1 post\(s\) are due/);
  });

  it("backs off before it complains about a missing secret", async () => {
    const { deps } = fakes();
    const outcome = await runPublish(deps, {
      ...options,
      failingSince: new Date("2026-10-14T04:00:00Z"),
      hasHook: false,
    });
    assert.equal(outcome.kind, "backed-off");
  });

  it("still calls the hook while the failure issue is young", async () => {
    const { calls, deps } = fakes();
    const outcome = await runPublish(deps, {
      ...options,
      failingSince: new Date("2026-10-14T07:00:00Z"),
    });
    assert.equal(outcome.kind, "published");
    assert.equal(calls.hook, 1);
  });
});
