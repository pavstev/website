import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isSlug, postSlug } from "./slug.ts";

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
