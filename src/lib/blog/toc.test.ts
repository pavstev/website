import assert from "node:assert/strict";
import { describe, it } from "node:test";
import rehypeSlug from "rehype-slug";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { VFile } from "vfile";

import { rehypeHeadingAnchors } from "./anchors.ts";
import { branchOf, currentSection, rehypeToc, type TocItem } from "./toc.ts";

const tocOf = async (markdown: string): Promise<unknown> => {
  const file = new VFile(markdown);
  const processor = unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeHeadingAnchors, { label: "Link to {heading}" })
    .use(rehypeToc);
  await processor.run(processor.parse(file), file);
  return file.data.toc;
};

describe("rehypeToc", () => {
  it("collects h2 and h3 with their ids and text", async () => {
    assert.deepEqual(await tocOf("## A\n\n### B\n\n#### C\n\n# D"), [
      { depth: 2, id: "a", text: "A" },
      { depth: 3, id: "b", text: "B" },
    ]);
  });

  it("keeps inline text and skips the anchor link", async () => {
    assert.deepEqual(await tocOf("## The `sky` *shader*"), [
      { depth: 2, id: "the-sky-shader", text: "The sky shader" },
    ]);
  });

  it("returns an empty list without headings", async () => {
    assert.deepEqual(await tocOf("Just text."), []);
  });
});

describe("currentSection", () => {
  it("picks the last heading at or above the line", () => {
    assert.equal(currentSection([-900, -200, 100, 700], 240), 2);
    assert.equal(currentSection([-900, -200, 300, 700], 240), 1);
    assert.equal(currentSection([-900, -200, 240], 240), 2);
  });

  it("returns -1 above the first heading", () => {
    assert.equal(currentSection([400, 900], 240), -1);
    assert.equal(currentSection([], 240), -1);
  });
});

describe("branchOf", () => {
  const items: TocItem[] = [
    { depth: 2, id: "a", text: "A" },
    { depth: 3, id: "b", text: "B" },
    { depth: 3, id: "c", text: "C" },
    { depth: 2, id: "d", text: "D" },
    { depth: 3, id: "e", text: "E" },
  ];

  it("joins a sub-heading to its trunk, and ends the trunk at the last one", () => {
    assert.deepEqual(
      items.map((_, index) => branchOf(items, index)),
      [undefined, "mid", "last", undefined, "last"]
    );
  });
});
