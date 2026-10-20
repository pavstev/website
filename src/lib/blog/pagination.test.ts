import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { listingPage, listingParams } from "./listing-route.ts";
import {
  blogListing,
  blogPageParams,
  tagListing,
  tagPageParams,
} from "./listing.ts";
import {
  laterPages,
  pageCount,
  pageHref,
  pageSize,
  pageSlice,
  pageWindow,
  parsePage,
} from "./pagination.ts";
import { postMeta } from "./post-fixture.ts";

const numbers = Array.from({ length: 23 }, (_, index) => index + 1);

describe("pagination", () => {
  it("shows 10 posts a page", () => {
    assert.equal(pageSize, 10);
  });

  it("counts pages and keeps one page for an empty list", () => {
    assert.equal(pageCount(0), 1);
    assert.equal(pageCount(10), 1);
    assert.equal(pageCount(11), 2);
    assert.equal(pageCount(23), 3);
  });

  it("lists only pages after the first, so /page/1 never exists", () => {
    assert.deepEqual(laterPages(10), []);
    assert.deepEqual(laterPages(23), [2, 3]);
  });

  it("links page 1 to the base path", () => {
    assert.equal(pageHref("/blog", 1), "/blog");
    assert.equal(pageHref("/blog", 3), "/blog/page/3");
    assert.equal(pageHref("/blog/tag/ai", 2), "/blog/tag/ai/page/2");
  });

  it("slices a page and refuses pages out of range", () => {
    assert.deepEqual(pageSlice(numbers, 3)?.items, [21, 22, 23]);
    assert.equal(pageSlice(numbers, 1)?.count, 3);
    assert.equal(pageSlice(numbers, 0), undefined);
    assert.equal(pageSlice(numbers, 4), undefined);
    assert.equal(pageSlice(numbers, 1.5), undefined);
    assert.deepEqual(pageSlice([], 1)?.items, []);
  });

  it("shows every page when they all fit the window", () => {
    assert.deepEqual(pageWindow(1, 1), [1]);
    assert.deepEqual(pageWindow(2, 3), [1, 2, 3]);
    assert.deepEqual(pageWindow(4, 7), [1, 2, 3, 4, 5, 6, 7]);
  });

  it("keeps the first pages and one gap near the start", () => {
    assert.deepEqual(pageWindow(1, 12), [1, 2, 3, 4, 5, "gap-r", 12]);
    assert.deepEqual(pageWindow(3, 12), [1, 2, 3, 4, 5, "gap-r", 12]);
  });

  it("keeps the last pages and one gap near the end", () => {
    assert.deepEqual(pageWindow(12, 12), [1, "gap-l", 8, 9, 10, 11, 12]);
    assert.deepEqual(pageWindow(10, 12), [1, "gap-l", 8, 9, 10, 11, 12]);
  });

  it("puts the neighbors between two gaps in the middle", () => {
    assert.deepEqual(pageWindow(6, 12), [1, "gap-l", 5, 6, 7, "gap-r", 12]);
    assert.deepEqual(pageWindow(4, 12), [1, "gap-l", 3, 4, 5, "gap-r", 12]);
    assert.deepEqual(pageWindow(9, 12), [1, "gap-l", 8, 9, 10, "gap-r", 12]);
  });

  it("always returns the same number of slots once the pages overflow", () => {
    for (let page = 1; page <= 20; page += 1)
      assert.equal(pageWindow(page, 20).length, 7);
  });

  it("honors wider siblings and boundaries", () => {
    assert.deepEqual(pageWindow(10, 20, 2, 2), [
      1,
      2,
      "gap-l",
      8,
      9,
      10,
      11,
      12,
      "gap-r",
      19,
      20,
    ]);
  });

  it("reads only plain positive page numbers", () => {
    assert.equal(parsePage("2"), 2);
    assert.equal(parsePage("02"), undefined);
    assert.equal(parsePage("0"), undefined);
    assert.equal(parsePage("2a"), undefined);
  });
});

describe("listings", () => {
  const posts = Array.from({ length: 12 }, (_, index) =>
    postMeta({
      slug: `p-${String(index)}`,
      tags: index % 2 === 0 ? ["AI", "Claude Code"] : ["AI"],
    })
  );

  it("builds the blog pages with absolute self URLs", () => {
    assert.deepEqual(blogPageParams(posts), [{ n: "2" }]);
    assert.equal(blogListing(posts, 1)?.url, "https://stevanpavlovic.com/blog");
    assert.equal(blogListing(posts, 2)?.posts.length, 2);
    assert.equal(
      blogListing(posts, 2)?.url,
      "https://stevanpavlovic.com/blog/page/2"
    );
    assert.equal(blogListing(posts, 3), undefined);
  });

  it("builds tag pages and their later pages", () => {
    assert.deepEqual(tagPageParams(posts), [{ n: "2", tag: "ai" }]);
    const tagged = tagListing(posts, "claude-code", 1);
    assert.equal(tagged?.posts.length, 6);
    assert.equal(tagged?.tag?.name, "Claude Code");
    assert.equal(tagged?.base, "/blog/tag/claude-code");
    assert.equal(
      tagListing(posts, "ai", 2)?.url,
      "https://stevanpavlovic.com/blog/tag/ai/page/2"
    );
    assert.equal(tagListing(posts, "nope", 1), undefined);
  });
});

describe("the listing route", () => {
  const posts = Array.from({ length: 12 }, (_, index) =>
    postMeta({
      slug: `p-${String(index)}`,
      tags: index % 2 === 0 ? ["AI", "Claude Code"] : ["AI"],
    })
  );

  it("lists every later page, tag page and later tag page", () => {
    assert.deepEqual(listingParams(posts), [
      { rest: ["2"], slug: "page" },
      { rest: ["ai"], slug: "tag" },
      { rest: ["claude-code"], slug: "tag" },
      { rest: ["ai", "page", "2"], slug: "tag" },
    ]);
  });

  it("titles each page", () => {
    assert.equal(
      listingPage(posts, { rest: ["2"], slug: "page" })?.heading,
      "Blog, page 2"
    );
    assert.equal(
      listingPage(posts, { rest: ["claude-code"], slug: "tag" })?.heading,
      "Posts tagged Claude Code"
    );
    assert.equal(
      listingPage(posts, { rest: ["ai", "page", "2"], slug: "tag" })?.heading,
      "Posts tagged AI, page 2"
    );
  });

  it("has no page 1 and no other shapes", () => {
    for (const params of [
      { rest: ["1"], slug: "page" },
      { rest: ["3"], slug: "page" },
      { rest: ["2", "x"], slug: "page" },
      { rest: ["ai", "page", "1"], slug: "tag" },
      { rest: ["ai", "pages", "2"], slug: "tag" },
      { rest: ["ai", "page"], slug: "tag" },
      { rest: ["nope"], slug: "tag" },
      { rest: ["2"], slug: "post" },
    ]) {
      assert.equal(
        listingPage(posts, params),
        undefined,
        JSON.stringify(params)
      );
    }
  });
});
