import type { Element, Root } from "hast";

import { visit } from "unist-util-visit";

export const anchorClass = "heading-anchor";

export const footnoteLabel = "footnote-label";

interface AnchorOptions {
  label: string;
}

const plainText = (node: Element): string =>
  node.children
    .map((child) =>
      child.type === "text"
        ? child.value
        : child.type === "element"
          ? plainText(child)
          : ""
    )
    .join("")
    .replaceAll(/\s+/g, " ")
    .trim();

export const rehypeHeadingAnchors =
  ({ label }: AnchorOptions) =>
  (tree: Root): void => {
    visit(tree, "element", (node) => {
      const { id } = node.properties;
      if (
        typeof id !== "string" ||
        (node.tagName !== "h2" && node.tagName !== "h3") ||
        id.endsWith(footnoteLabel)
      ) {
        return;
      }
      const labelId = `${id}:text`;
      node.properties.ariaLabelledBy = [labelId];
      node.children = [
        {
          children: node.children,
          properties: { id: labelId },
          tagName: "span",
          type: "element",
        },
      ];
      node.children.push({
        children: [{ type: "text", value: "#" }],
        properties: {
          ariaLabel: label.replace("{heading}", () => plainText(node)),
          className: [anchorClass, "focus-ring"],
          href: `#${id}`,
        },
        tagName: "a",
        type: "element",
      });
    });
  };
