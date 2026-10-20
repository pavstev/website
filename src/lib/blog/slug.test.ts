import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isBlogPage, isSitePage, isSlug, postSlug } from "./slug.ts";

describe("isSlug", () => {
  for (const slug of ["a", "a-b", "how-i-use-ai", "a1-2b", "a".repeat(80)]) {
    it(`accepts ${JSON.stringify(slug)}`, () => {
      assert.equal(isSlug(slug), true);
    });
  }

  for (const slug of [
    "",
    "a--b",
    "-a",
    "a-",
    "A",
    "a_b",
    "a b",
    "a/b",
    "../x",
    "a".repeat(81),
  ]) {
    it(`rejects ${JSON.stringify(slug)}`, () => {
      assert.equal(isSlug(slug), false);
    });
  }
});

describe("postSlug", () => {
  it("returns the slug of a post path", () => {
    assert.equal(postSlug("/blog/how-i-use-ai"), "how-i-use-ai");
  });

  for (const path of [
    "/",
    "/blog",
    "/blog/",
    "/blog/feed.xml",
    "/blog/feed.json",
    "/blog/page/2",
    "/blog/tag/ai",
    "/blog/tag/ai/page/2",
    "/resume.pdf",
  ]) {
    it(`ignores ${JSON.stringify(path)}`, () => {
      assert.equal(postSlug(path), undefined);
    });
  }
});

describe("isBlogPage", () => {
  for (const path of [
    "/blog",
    "/blog/how-i-use-ai",
    "/blog/tag/ai",
    "/blog/tag/ai/page/2",
    "/blog/page/2",
  ]) {
    it(`accepts ${JSON.stringify(path)}`, () => {
      assert.equal(isBlogPage(path), true);
    });
  }

  for (const path of [
    "/",
    "/blogger",
    "/blog/feed.xml",
    "/blog/feed.json",
    "/resume.pdf",
    "/cv.json",
  ]) {
    it(`rejects ${JSON.stringify(path)}`, () => {
      assert.equal(isBlogPage(path), false);
    });
  }
});

describe("isSitePage", () => {
  for (const path of [
    "/about",
    "/work",
    "/blog",
    "/blog/how-i-use-ai",
    "/blog/tag/ai/page/2",
  ]) {
    it(`accepts ${JSON.stringify(path)}`, () => {
      assert.equal(isSitePage(path), true);
    });
  }

  for (const path of [
    "/",
    "/about/me",
    "/work.html",
    "/workshop",
    "/blog/feed.xml",
    "/resume.pdf",
  ]) {
    it(`rejects ${JSON.stringify(path)}`, () => {
      assert.equal(isSitePage(path), false);
    });
  }
});
