import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isSlug } from "./slug.ts";

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
