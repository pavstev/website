import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isExternalHref, leavesBlog } from "./links.ts";

describe("isExternalHref", () => {
  it("treats the site itself as internal", () => {
    for (const href of [
      "https://stevanpavlovic.com",
      "https://stevanpavlovic.com/blog/other",
      "HTTPS://StevanPavlovic.com/blog",
      "//stevanpavlovic.com/blog",
      "/blog/other",
      "#notes",
      "other",
      "mailto:hi@example.com",
    ]) {
      assert.equal(isExternalHref(href), false, href);
    }
  });

  it("treats other origins as external", () => {
    for (const href of [
      "https://stevanpavlovic.com.example",
      "https://stevanpavlovic.com.example/blog",
      "https://stevanpavlovic.com@example.com/",
      "https://stevanpavlovic.com:8443/blog",
      "https://www.stevanpavlovic.com/",
      "//example.com/a",
      "https://github.com/pavstev",
    ]) {
      assert.equal(isExternalHref(href), true, href);
    }
  });
});

describe("leavesBlog", () => {
  it("flags internal links to pages and files outside the blog pages", () => {
    for (const href of [
      "/",
      "/resume.pdf",
      "/cv.json",
      "/llms.txt",
      "/blog/feed.xml",
      "/blog/feed.json",
      "https://stevanpavlovic.com/",
      "//stevanpavlovic.com/resume.pdf",
    ]) {
      assert.equal(leavesBlog(href), true, href);
    }
  });

  it("keeps blog pages, anchors, mail and other origins as they are", () => {
    for (const href of [
      "/blog",
      "/blog/other",
      "/blog/tag/ai",
      "/blog/page/2",
      "/blog/other#notes",
      "#notes",
      "other",
      "mailto:hi@example.com",
      "https://github.com/pavstev",
    ]) {
      assert.equal(leavesBlog(href), false, href);
    }
  });
});
