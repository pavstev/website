import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { morphPlan } from "./title-morph.ts";

describe("morphPlan", () => {
  it("morphs the card title into the post title", () => {
    assert.deepEqual(morphPlan("/blog", "/blog/how-i-use-ai"), {
      from: "row",
      slug: "how-i-use-ai",
      to: "post",
    });
  });

  it("morphs the post title back into the card title", () => {
    assert.deepEqual(morphPlan("/blog/how-i-use-ai", "/blog"), {
      from: "post",
      slug: "how-i-use-ai",
      to: "row",
    });
  });

  it("treats tag and page listings like the index", () => {
    assert.equal(morphPlan("/blog/tag/ai", "/blog/a-post")?.from, "row");
    assert.equal(morphPlan("/blog/page/2", "/blog/a-post")?.from, "row");
    assert.equal(morphPlan("/blog/a-post", "/blog/tag/ai")?.to, "row");
    assert.equal(morphPlan("/blog/a-post", "/blog/page/2")?.to, "row");
  });

  it("does not morph between two posts or two listings", () => {
    assert.equal(morphPlan("/blog/a-post", "/blog/b-post"), undefined);
    assert.equal(morphPlan("/blog", "/blog/tag/ai"), undefined);
    assert.equal(morphPlan("/blog", "/blog"), undefined);
  });

  it("ignores feeds and pages outside the blog", () => {
    assert.equal(morphPlan("/blog", "/blog/feed.xml"), undefined);
    assert.equal(morphPlan("/blog/a-post", "/"), undefined);
    assert.equal(morphPlan("/", "/blog"), undefined);
  });
});
