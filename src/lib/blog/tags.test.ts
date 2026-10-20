import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { postMeta } from "./post-fixture.ts";
import { findTag, postsTagged, tagHref, tagIndex, tagSlug } from "./tags.ts";

describe("tagSlug", () => {
  it("lowercases and joins words with single dashes", () => {
    assert.equal(tagSlug("Claude Code"), "claude-code");
    assert.equal(tagSlug("Next.js"), "next-js");
    assert.equal(tagSlug("AI"), "ai");
    assert.equal(tagSlug("  Web  GL!! "), "web-gl");
    assert.equal(tagSlug("Café Wien"), "cafe-wien");
  });

  it("builds the tag page path", () => {
    assert.equal(tagHref("Claude Code"), "/blog/tag/claude-code");
  });
});

describe("tagIndex", () => {
  const posts = [
    postMeta({ slug: "a", tags: ["AI", "Next.js"] }),
    postMeta({ slug: "b", tags: ["AI"] }),
    postMeta({ slug: "c", tags: ["Workflow"] }),
  ];

  it("counts posts per tag, most used first, then by name", () => {
    assert.deepEqual(tagIndex(posts), [
      { count: 2, name: "AI", slug: "ai" },
      { count: 1, name: "Next.js", slug: "next-js" },
      { count: 1, name: "Workflow", slug: "workflow" },
    ]);
  });

  it("fails when two spellings map to one slug", () => {
    assert.throws(
      () => tagIndex([...posts, postMeta({ slug: "d", tags: ["ai"] })]),
      /"AI" and "ai" \(d\) both map to \/blog\/tag\/ai/
    );
    assert.throws(
      () => tagIndex([...posts, postMeta({ slug: "e", tags: ["Next JS"] })]),
      /next-js/
    );
  });

  it("fails on a tag without letters or digits", () => {
    assert.throws(
      () => tagIndex([postMeta({ slug: "f", tags: ["!!"] })]),
      /no letters or digits/
    );
  });

  it("finds a tag and its posts by slug", () => {
    assert.equal(findTag(posts, "next-js")?.name, "Next.js");
    assert.equal(findTag(posts, "nope"), undefined);
    assert.deepEqual(
      postsTagged(posts, "ai").map((post) => post.slug),
      ["a", "b"]
    );
  });
});
