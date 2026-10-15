import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { prefetchUrl } from "./link-prefetch.ts";

const here = "https://stevanpavlovic.com/";

describe("prefetchUrl", () => {
  it("keeps same-origin page links and drops the hash", () => {
    assert.equal(
      prefetchUrl("https://stevanpavlovic.com/blog#top", here),
      "https://stevanpavlovic.com/blog"
    );
    assert.equal(
      prefetchUrl("/blog/page/2", here),
      "https://stevanpavlovic.com/blog/page/2"
    );
  });

  it("keeps the query string", () => {
    assert.equal(
      prefetchUrl("/blog/tag/astro?x=1", here),
      "https://stevanpavlovic.com/blog/tag/astro?x=1"
    );
  });

  it("skips other origins", () => {
    assert.equal(prefetchUrl("https://github.com/pavstev", here), null);
  });

  it("skips the page you are on", () => {
    assert.equal(prefetchUrl("/", here), null);
    assert.equal(
      prefetchUrl("/blog#list", "https://stevanpavlovic.com/blog"),
      null
    );
  });

  it("skips files such as the résumé and the feeds", () => {
    assert.equal(prefetchUrl("/resume.pdf", here), null);
    assert.equal(prefetchUrl("/blog/feed.xml", here), null);
  });

  it("skips a link that cannot be parsed", () => {
    assert.equal(prefetchUrl("http://", here), null);
  });
});
