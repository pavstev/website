import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { builtInstant, pageRobots } from "./build-env.ts";

describe("pageRobots", () => {
  it("asks for indexing and large image previews", () => {
    assert.deepEqual(pageRobots, {
      follow: true,
      googleBot: {
        follow: true,
        index: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
      index: true,
    });
  });
});

describe("builtInstant", () => {
  it("reads BLOG_BUILT_AT as one instant", () => {
    assert.equal(
      builtInstant({ BLOG_BUILT_AT: "2026-10-13T21:59:59.500Z" })?.getTime(),
      Date.parse("2026-10-13T21:59:59.500Z")
    );
  });

  it("is undefined when the variable is missing, empty or not a date", () => {
    assert.equal(builtInstant({}), undefined);
    assert.equal(builtInstant({ BLOG_BUILT_AT: " " }), undefined);
    assert.equal(builtInstant({ BLOG_BUILT_AT: "soon" }), undefined);
  });
});
