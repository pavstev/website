import type { Element, ElementContent, Root } from "hast";
import type { VFile } from "vfile";

import { visit } from "unist-util-visit";

import { anchorClass, sectionHeading } from "./anchors.ts";

export interface TocItem {
  depth: 2 | 3;
  id: string;
  text: string;
}

declare module "vfile" {
  interface DataMap {
    toc: TocItem[];
  }
}

const isAnchor = (node: Element): boolean => {
  const { className } = node.properties;
  return Array.isArray(className) && className.includes(anchorClass);
};

const textOf = (nodes: ElementContent[]): string =>
  nodes
    .map((node) => {
      if (node.type === "text") {
        return node.value;
      }
      return node.type === "element" && !isAnchor(node)
        ? textOf(node.children)
        : "";
    })
    .join("");

const collectToc = (tree: Root, file: VFile): void => {
  const toc: TocItem[] = [];
  visit(tree, "element", (node) => {
    const heading = sectionHeading(node);
    if (heading !== undefined) {
      toc.push({
        ...heading,
        text: textOf(node.children).replaceAll(/\s+/g, " ").trim(),
      });
    }
  });
  file.data.toc = toc;
};

export const rehypeToc = (): typeof collectToc => collectToc;

export const tocLine = 0.3;

export const currentSection = (tops: readonly number[], line: number): number =>
  tops.findLastIndex((top) => top <= line);
