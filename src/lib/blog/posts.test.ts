import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";

import { isPreviewBuild, showDrafts } from "./build-env.ts";
import {
  findPost,
  lastModified,
  listPosts,
  readingStats,
  readPostSources,
  visibleSources,
} from "./posts.ts";

const fixtures = path.join(import.meta.dirname, "fixtures");
const valid = path.join(fixtures, "valid");
const broken = path.join(fixtures, "broken");

describe("listPosts", () => {
  it("hides drafts and orders by date, then title", () => {
    const posts = listPosts({ drafts: false }, valid);
    assert.deepEqual(
      posts.map((post) => post.slug),
      ["alpha", "beta"]
    );
  });

  it("shows drafts when asked, newest first", () => {
    const posts = listPosts({ drafts: true }, valid);
    assert.deepEqual(
      posts.map((post) => post.slug),
      ["gamma", "alpha", "beta"]
    );
  });

  it("derives the slug, the absolute URL and the reading stats", () => {
    const [alpha] = listPosts({ drafts: false }, valid);
    assert.equal(alpha?.slug, "alpha");
    assert.equal(alpha?.url, "https://stevanpavlovic.com/blog/alpha");
    assert.equal(alpha?.readingMinutes, 1);
    assert.ok((alpha?.wordCount ?? 0) > 5);
  });
});

const slugs = (options: { drafts: boolean; now: Date }): string[] =>
  listPosts(options, valid).map((post) => post.slug);

describe("scheduled posts", () => {
  it("hides a post dated after the build day", () => {
    const now = new Date("2026-10-11T10:00:00Z");
    assert.deepEqual(slugs({ drafts: false, now }), []);
    assert.equal(findPost("alpha", { drafts: false, now }, valid), undefined);
    assert.equal(visibleSources({ drafts: false, now }, valid).length, 0);
  });

  it("shows a post dated on the build day", () => {
    const now = new Date("2026-10-12T10:00:00Z");
    assert.deepEqual(slugs({ drafts: false, now }), ["alpha", "beta"]);
  });

  it("counts the Vienna day when the UTC day is still the day before", () => {
    assert.deepEqual(
      slugs({ drafts: false, now: new Date("2026-10-11T22:30:00Z") }),
      ["alpha", "beta"]
    );
    assert.deepEqual(
      slugs({ drafts: false, now: new Date("2026-10-11T21:30:00Z") }),
      []
    );
  });

  it("shows scheduled posts where drafts show", () => {
    const now = new Date("2026-10-11T10:00:00Z");
    assert.deepEqual(slugs({ drafts: true, now }), ["gamma", "alpha", "beta"]);
  });
});

describe("findPost", () => {
  it("finds a post by slug and hides a draft unless asked", () => {
    assert.equal(
      findPost("beta", { drafts: false }, valid)?.meta.title,
      "Beta"
    );
    assert.equal(findPost("gamma", { drafts: false }, valid), undefined);
    assert.equal(findPost("gamma", { drafts: true }, valid)?.slug, "gamma");
    assert.equal(findPost("nope", { drafts: true }, valid), undefined);
  });
});

describe("readPostSources", () => {
  it("strips the frontmatter from the body", () => {
    const beta = readPostSources(valid).find((post) => post.slug === "beta");
    assert.ok(beta?.body.trimStart().startsWith("Beta links"));
    assert.equal(beta?.dir, path.join(valid, "content/blog/beta"));
  });

  it("names the file and the field when the frontmatter is wrong", () => {
    assert.throws(
      () => readPostSources(broken),
      (error: unknown) =>
        error instanceof Error &&
        error.message.startsWith("content/blog/bad/index.mdx: description: ")
    );
  });
});

describe("visibleSources", () => {
  it("keeps the source folder and draft flag of each source", () => {
    const gamma = visibleSources({ drafts: true }, valid).find(
      (source) => source.slug === "gamma"
    );
    assert.equal(gamma?.meta.draft, true);
    assert.equal(gamma?.dir, path.join(valid, "content/blog/gamma"));
    assert.equal(
      visibleSources({ drafts: false }, valid).some(
        (source) => source.meta.draft
      ),
      false
    );
  });
});

describe("readingStats", () => {
  it("ignores fenced code and JSX tags", () => {
    const code = Array.from(
      { length: 300 },
      (_, index) => `word${String(index)}`
    ).join(" ");
    const body = [
      "One two three four five.",
      "",
      "```ts",
      code,
      "```",
      "",
      '<Figure src="./a.png" alt="ignored words here" caption="also ignored" />',
      "",
      "<Note>six seven</Note>",
    ].join("\n");
    assert.deepEqual(readingStats(body), { minutes: 1, words: 7 });
  });

  it("returns at least one minute and rounds at 230 words a minute", () => {
    assert.equal(readingStats("").minutes, 1);
    assert.equal(readingStats("word ".repeat(690)).minutes, 3);
  });
});

describe("build env", () => {
  it("treats a branch other than main as a preview with drafts", () => {
    const env = { WORKERS_CI_BRANCH: "blog" };
    assert.equal(isPreviewBuild(env), true);
    assert.equal(showDrafts(env), true);
  });

  it("treats main as production without drafts", () => {
    const env = { WORKERS_CI_BRANCH: "main" };
    assert.equal(isPreviewBuild(env), false);
    assert.equal(showDrafts(env), false);
  });

  it("shows drafts without a branch only in development or when asked", () => {
    assert.equal(isPreviewBuild({}), false);
    assert.equal(showDrafts({}), false);
    assert.equal(showDrafts({ NODE_ENV: "production" }), false);
    assert.equal(showDrafts({ NODE_ENV: "development" }), true);
    assert.equal(showDrafts({ BLOG_DRAFTS: "1" }), true);
    assert.equal(showDrafts({ BLOG_DRAFTS: "0" }), false);
  });
});

describe("lastModified", () => {
  const posts = listPosts({ drafts: false }, path.join(fixtures, "valid"));

  it("takes the newest updated or date across posts, not the first date", () => {
    const [first, second] = posts;
    assert.ok(first !== undefined && second !== undefined);
    assert.equal(
      lastModified([first, { ...second, updated: "2030-01-02" }]),
      "2030-01-02"
    );
    assert.equal(
      lastModified([
        { ...first, date: "2020-01-01" },
        { ...second, date: "2021-05-05", updated: undefined },
      ]),
      "2021-05-05"
    );
  });

  it("gives nothing without posts", () => {
    assert.equal(lastModified([]), undefined);
  });
});
