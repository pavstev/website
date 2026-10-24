import type { Element, Root } from "hast";

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import rehypeSlug from "rehype-slug";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

import { rehypeHeadingAnchors } from "./anchors.ts";

const treeOf = async (markdown: string): Promise<Root> => {
  const processor = unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeHeadingAnchors, { label: "Link to {heading}" });
  return processor.run(processor.parse(markdown));
};

const elements = (node: Element | Root): Element[] =>
  node.children.flatMap((child) =>
    child.type === "element" ? [child, ...elements(child)] : []
  );

const textOf = (node: Element): string =>
  node.children
    .map((child) =>
      child.type === "text"
        ? child.value
        : child.type === "element"
          ? textOf(child)
          : ""
    )
    .join("");

const nameOf = (tree: Root, heading: Element): string => {
  const ids = heading.properties.ariaLabelledBy;
  assert.ok(Array.isArray(ids) && ids.length > 0);
  return ids
    .map((id) => {
      const target = elements(tree).find((node) => node.properties.id === id);
      assert.ok(target !== undefined);
      return textOf(target);
    })
    .join(" ");
};

const headingsOf = (tree: Root): Element[] =>
  elements(tree).filter((node) => ["h2", "h3"].includes(node.tagName));

describe("rehypeHeadingAnchors", () => {
  it("names each heading by its text alone", async () => {
    const tree = await treeOf("## The `sky` *shader*\n\n### Clouds");
    assert.deepEqual(
      headingsOf(tree).map((heading) => nameOf(tree, heading)),
      ["The sky shader", "Clouds"]
    );
  });

  it("keeps a labelled, focusable anchor link inside the heading", async () => {
    const tree = await treeOf("## The `sky` *shader*");
    const [heading] = headingsOf(tree);
    assert.ok(heading !== undefined);
    const link = elements(heading).find((node) => node.tagName === "a");
    assert.equal(link?.properties.href, "#the-sky-shader");
    assert.equal(link?.properties.ariaLabel, "Link to The sky shader");
    assert.equal(link?.properties.tabIndex, undefined);
    assert.equal(link?.properties.ariaHidden, undefined);
  });

  it("gives the label element an id no heading slug can take", async () => {
    const tree = await treeOf("## A\n\n## A title\n\n## A text\n\n## A-label");
    const ids = elements(tree)
      .map((node) => node.properties.id)
      .filter((id) => typeof id === "string");
    assert.equal(ids.length, 8);
    assert.equal(new Set(ids).size, ids.length);
  });
});
