import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";

export interface SourceNode {
  alt?: null | string | undefined;
  attributes?: unknown[];
  children?: SourceNode[];
  label?: null | string | undefined;
  name?: null | string | undefined;
  position?: undefined | { end: Point; start: Point };
  title?: null | string | undefined;
  type: string;
  url?: string;
}

interface Point {
  offset?: number | undefined;
}

const trees = new Map<string, SourceNode>();

export const parseMdx = (body: string): SourceNode => {
  const cached = trees.get(body);
  if (cached !== undefined) {
    return cached;
  }
  const tree: SourceNode = unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkGfm)
    .parse(body);
  trees.set(body, tree);
  return tree;
};
