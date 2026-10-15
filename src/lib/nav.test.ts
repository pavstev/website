import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { navCurrent, navItems } from "./nav.ts";

describe("navItems", () => {
  it("lists About, Work and Blog in that order", () => {
    assert.deepEqual(
      navItems.map(({ label, path }) => [label, path]),
      [
        ["About", "/about"],
        ["Work", "/work"],
        ["Blog", "/blog"],
      ]
    );
  });
});

describe("navCurrent", () => {
  it("is page on the exact path", () => {
    assert.equal(navCurrent("/about", "/about"), "page");
    assert.equal(navCurrent("/work", "/work"), "page");
    assert.equal(navCurrent("/blog", "/blog"), "page");
  });

  it("ignores a trailing slash and the html suffix", () => {
    assert.equal(navCurrent("/blog/", "/blog"), "page");
    assert.equal(navCurrent("/blog.html", "/blog"), "page");
  });

  it("is true for a page inside the section", () => {
    assert.equal(navCurrent("/blog/some-post", "/blog"), "true");
    assert.equal(navCurrent("/blog/page/2", "/blog"), "true");
    assert.equal(navCurrent("/blog/tag/ai", "/blog"), "true");
  });

  it("is undefined elsewhere", () => {
    assert.equal(navCurrent("/about", "/work"), undefined);
    assert.equal(navCurrent("/blogger", "/blog"), undefined);
    assert.equal(navCurrent("/", "/blog"), undefined);
  });
});
