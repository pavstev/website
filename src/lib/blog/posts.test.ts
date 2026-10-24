import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";

import { showDrafts } from "./build-env.ts";
import { lastModified } from "./modified.ts";
import {
  postMeta,
  postSource,
  validSources as sources,
} from "./post-fixture.ts";
import { findPost, listPosts, sourceOf } from "./posts.ts";

const slugs = (options: { drafts: boolean; now?: Date }): string[] =>
  listPosts(options, sources).map((post) => post.slug);

describe("listPosts", () => {
  it("hides drafts and orders by date, then title", () => {
    assert.deepEqual(slugs({ drafts: false, now: new Date("2027-01-01") }), [
      "alpha",
      "beta",
    ]);
  });

  it("shows drafts when asked, newest first", () => {
    assert.deepEqual(slugs({ drafts: true, now: new Date("2027-01-01") }), [
      "gamma",
      "alpha",
      "beta",
    ]);
  });

  it("orders posts with the same date by title", () => {
    const same = ["b", "a"].map((slug) =>
      postSource("Text.", "/x", { slug, title: slug })
    );
    assert.deepEqual(
      listPosts({ drafts: false, now: new Date("2027-01-01") }, same).map(
        (post) => post.slug
      ),
      ["a", "b"]
    );
  });
});

describe("scheduled posts", () => {
  it("hides every post before its exact go-live instant", () => {
    const now = new Date("2026-10-12T05:59:59Z");
    assert.deepEqual(slugs({ drafts: false, now }), []);
    assert.equal(findPost("alpha", { drafts: false, now }, sources), undefined);
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
      assert.deepEqual(slugs({ drafts: false }), []);
      process.env["BLOG_BUILT_AT"] = "2026-10-12T17:00:00Z";
      assert.deepEqual(slugs({ drafts: false }), ["alpha", "beta"]);
    } finally {
      if (saved === undefined) delete process.env["BLOG_BUILT_AT"];
      else process.env["BLOG_BUILT_AT"] = saved;
    }
  });
});

describe("findPost", () => {
  it("finds a post by slug and hides a draft unless asked", () => {
    const now = new Date("2027-01-01");
    assert.equal(
      findPost("beta", { drafts: false, now }, sources)?.meta.title,
      "Beta"
    );
    assert.equal(findPost("gamma", { drafts: false, now }, sources), undefined);
    assert.equal(
      findPost("gamma", { drafts: true, now }, sources)?.slug,
      "gamma"
    );
    assert.equal(findPost("nope", { drafts: true, now }, sources), undefined);
  });
});

const entry = (id: string): Parameters<typeof sourceOf>[0] => ({
  body: "One two three.",
  data: {
    date: "2026-10-13T09:30:00+02:00",
    description: "About a post.",
    draft: false,
    tags: ["Test"],
    title: "A post",
  },
  filePath: `content/blog/${id}/index.mdx`,
  id,
});

describe("sourceOf", () => {
  it("derives the slug, the absolute URL, the folder and the reading stats", () => {
    const source = sourceOf(entry("alpha"));
    assert.equal(source.slug, "alpha");
    assert.equal(source.meta.url, "https://stevanpavlovic.com/blog/alpha");
    assert.equal(source.meta.readingMinutes, 1);
    assert.equal(source.meta.wordCount, 3);
    assert.equal(source.dir, path.resolve("content/blog/alpha"));
  });

  it("rejects a folder name that is not a slug or is a blog route", () => {
    assert.throws(
      () => sourceOf(entry("Bad_Name")),
      /content\/blog\/Bad_Name\/index\.mdx: slug: /u
    );
    assert.throws(() => sourceOf(entry("tag")), /"tag" is a blog route/u);
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
  const first = postMeta({ date: "2026-10-12T18:15:00+02:00" });
  const second = postMeta({
    date: "2026-10-12T08:00:00+02:00",
    updated: "2026-10-13T07:45:00+02:00",
  });

  it("takes the newest updated or date across posts, not the first date", () => {
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
