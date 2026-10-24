import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseMdx } from "./mdx-tree.ts";

describe("parseMdx", () => {
  it("parses JSX and Markdown nodes", () => {
    const tree = parseMdx('Hello.\n\n<Figure src="a.webp" alt="A" />\n');
    assert.deepEqual(
      tree.children?.map((child) => child.type),
      ["paragraph", "mdxJsxFlowElement"]
    );
  });

  it("returns the same tree for the same body", () => {
    assert.equal(parseMdx("Same."), parseMdx("Same."));
  });

  it("returns another tree for another body", () => {
    assert.notEqual(parseMdx("One."), parseMdx("Two."));
  });
});
