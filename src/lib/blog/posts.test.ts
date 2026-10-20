import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";

import { showDrafts } from "./build-env.ts";
import {
  findPost,
  lastModified,
  listPosts,
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
  it("hides every post before its exact go-live instant", () => {
    const now = new Date("2026-10-12T05:59:59Z");
    assert.deepEqual(slugs({ drafts: false, now }), []);
    assert.equal(findPost("alpha", { drafts: false, now }, valid), undefined);
    assert.equal(visibleSources({ drafts: false, now }, valid).length, 0);
  });

  it("shows a post from its instant on, minute by minute", () => {
    assert.deepEqual(
      slugs({ drafts: false, now: new Date("2026-10-12T06:00:00Z") }),
      ["beta"]
    );
    assert.deepEqual(
      slugs({ drafts: false, now: new Date("2026-10-12T16:14:59Z") }),
      ["beta"]
    );
    assert.deepEqual(
      slugs({ drafts: false, now: new Date("2026-10-12T16:15:00Z") }),
      ["alpha", "beta"]
    );
  });

  it("shows scheduled posts where drafts show", () => {
    const now = new Date("2026-10-11T10:00:00Z");
    assert.deepEqual(slugs({ drafts: true, now }), ["gamma", "alpha", "beta"]);
  });
});

describe("the build instant", () => {
  it("is what listPosts uses when no now is passed", () => {
    const saved = process.env["BLOG_BUILT_AT"];
    try {
      process.env["BLOG_BUILT_AT"] = "2026-10-11T10:00:00Z";
      assert.deepEqual(
        listPosts({ drafts: false }, valid).map((post) => post.slug),
        []
      );
      process.env["BLOG_BUILT_AT"] = "2026-10-12T17:00:00Z";
      assert.deepEqual(
        listPosts({ drafts: false }, valid).map((post) => post.slug),
        ["alpha", "beta"]
      );
    } finally {
      if (saved === undefined) delete process.env["BLOG_BUILT_AT"];
      else process.env["BLOG_BUILT_AT"] = saved;
    }
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

  it("leaves the test posts out unless BLOG_FIXTURES=1 in development", () => {
    assert.deepEqual(
      readPostSources(valid, { BLOG_FIXTURES: "1", NODE_ENV: "production" })
        .length,
      3
    );
    assert.equal(readPostSources(valid, {}).length, 3);
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

describe("build env", () => {
  it("shows drafts only in development or when asked", () => {
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
      lastModified([
        first,
        { ...second, updated: "2030-01-02T09:00:00+01:00" },
      ]),
      "2030-01-02T09:00:00+01:00"
    );
    assert.equal(
      lastModified([
        { ...first, date: "2020-01-01T09:00:00+01:00" },
        { ...second, date: "2021-05-05T09:00:00+02:00", updated: undefined },
      ]),
      "2021-05-05T09:00:00+02:00"
    );
  });

  it("compares instants, not the written text", () => {
    const [first, second] = posts;
    assert.ok(first !== undefined && second !== undefined);
    assert.equal(
      lastModified([
        { ...first, date: "2026-10-13T09:00:00-05:00", updated: undefined },
        { ...second, date: "2026-10-13T12:00:00+02:00", updated: undefined },
      ]),
      "2026-10-13T09:00:00-05:00"
    );
  });

  it("gives nothing without posts", () => {
    assert.equal(lastModified([]), undefined);
  });
});
