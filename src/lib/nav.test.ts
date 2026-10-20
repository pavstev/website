import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { navCurrent, navFor, navItems, navOthers } from "./nav.ts";

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

describe("navFor", () => {
  it("keeps the Blog link while a post is live", () => {
    assert.deepEqual(navFor(true), navItems);
  });

  it("drops the Blog link when no post is live", () => {
    assert.deepEqual(
      navFor(false).map(({ path }) => path),
      ["/about", "/work"]
    );
  });
});

const paths = (pathname: string, live = true): string[] =>
  navOthers(pathname, live).map(({ path }) => path);

describe("navOthers", () => {
  it("leaves out the page you are on", () => {
    assert.deepEqual(paths("/work"), ["/about", "/blog"]);
    assert.deepEqual(paths("/about"), ["/work", "/blog"]);
    assert.deepEqual(paths("/blog"), ["/about", "/work"]);
  });

  it("leaves out the section of a page inside it", () => {
    assert.deepEqual(paths("/blog/some-post"), ["/about", "/work"]);
    assert.deepEqual(paths("/blog/tag/ai/page/2"), ["/about", "/work"]);
  });

  it("keeps every section on a page outside them", () => {
    assert.deepEqual(paths("/404"), ["/about", "/work", "/blog"]);
  });

  it("drops Blog when no post is live", () => {
    assert.deepEqual(paths("/work", false), ["/about"]);
  });
});
