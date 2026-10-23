import assert from "node:assert/strict";
import { it } from "node:test";

import { classify } from "./pages.ts";

it("classify maps paths to page kinds, first match wins", () => {
  assert.equal(classify("/"), "home");
  assert.equal(classify("/blog"), "blog");
  assert.equal(classify("/blog/tag/astro"), "listing");
  assert.equal(classify("/blog/page/2"), "listing");
  assert.equal(classify("/blog/hello-world"), "post");
  assert.equal(classify("/about"), "other");
  assert.equal(classify("/work"), "other");
  assert.equal(classify("/work/dotfiles"), "story");
  assert.equal(classify("/work/website"), "sky-story");
});
