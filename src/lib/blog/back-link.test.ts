import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { en } from "../i18n.ts";
import { backLink } from "./back-link.ts";

describe("backLink", () => {
  it("sends the index home without a prefetch", () => {
    for (const pathname of ["/blog", "/blog/"]) {
      assert.deepEqual(
        backLink(pathname),
        { href: "/", label: en.blog.home, prefetch: false },
        pathname
      );
    }
  });

  it("sends a post to the index", () => {
    for (const pathname of ["/blog/how-i-use-ai", "/blog/how-i-use-ai/"]) {
      assert.deepEqual(
        backLink(pathname),
        { href: "/blog", label: en.blog.back, prefetch: null },
        pathname
      );
    }
  });
});
