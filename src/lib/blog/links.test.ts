import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isExternalHref } from "./links.ts";

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
