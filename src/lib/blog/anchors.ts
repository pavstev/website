import type { Element, Root } from "hast";

import { visit } from "unist-util-visit";

export const anchorClass = "heading-anchor";

export const anchorAttribute = "data-heading-anchor";

const footnoteLabel = "footnote-label";

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

const sectionHeading = (
  node: Element
): undefined | { depth: 2 | 3; id: string } => {
  const { id } = node.properties;
  const depth =
    node.tagName === "h2" ? 2 : node.tagName === "h3" ? 3 : undefined;
  return depth === undefined ||
    typeof id !== "string" ||
    id.endsWith(footnoteLabel)
    ? undefined
    : { depth, id };
};

export const rehypeHeadingAnchors =
  ({ label }: AnchorOptions) =>
  (tree: Root): void => {
    visit(tree, "element", (node) => {
      const heading = sectionHeading(node);
      if (heading === undefined) {
        return;
      }
      const { id } = heading;
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
          [anchorAttribute]: "",
          ariaLabel: label.replace("{heading}", () => plainText(node)),
          className: [anchorClass, "focus-ring"],
          href: `#${id}`,
        },
        tagName: "a",
        type: "element",
      });
    });
  };
