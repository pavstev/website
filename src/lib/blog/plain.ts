import type { Element, Root } from "hast";

import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import * as z from "zod";

import { chartLines, isChartType, readChartFile } from "./chart-data.ts";
import { diagramText } from "./diagrams.ts";
import { absoluteUrl } from "./images.ts";
import { parseMdx, type SourceNode } from "./mdx-tree.ts";
import { type PostSource } from "./posts.ts";

export type ImageUrl = (src: string) => string;

interface Context {
  body: string;
  imageUrl: ImageUrl;
  source: PostSource;
}

const attributeShape = z.object({
  name: z.string(),
  type: z.literal("mdxJsxAttribute"),
  value: z.unknown(),
});

const jsxTypes = new Set(["mdxJsxFlowElement", "mdxJsxTextElement"]);
const droppedTypes = new Set([
  "mdxFlowExpression",
  "mdxjsEsm",
  "mdxTextExpression",
]);

const startOf = (node: SourceNode): number => node.position?.start.offset ?? 0;
const endOf = (node: SourceNode): number => node.position?.end.offset ?? 0;

const attribute = (node: SourceNode, name: string): string => {
  const items = node.attributes ?? [];
  for (const item of items) {
    const parsed = attributeShape.safeParse(item);
    if (
      parsed.success &&
      parsed.data.name === name &&
      typeof parsed.data.value === "string"
    ) {
      return parsed.data.value;
    }
  }
  return "";
};

const escapeAlt = (alt: string): string =>
  alt.replaceAll(/([[\]\\])/g, String.raw`\$1`);

const dedent = (text: string): string => {
  const [first = "", ...rest] = text.split("\n");
  const indents = rest
    .filter((line) => line.trim() !== "")
    .map((line) => line.length - line.trimStart().length);
  const cut = indents.length > 0 ? Math.min(...indents) : 0;
  return [first, ...rest.map((line) => line.slice(cut))].join("\n").trim();
};

const quote = (text: string): string =>
  text
    .split("\n")
    .map((line) => (line.trim() === "" ? ">" : `> ${line}`))
    .join("\n");

const chartList = (context: Context, node: SourceNode): string => {
  const type = attribute(node, "type");
  if (!isChartType(type))
    throw new Error(`${context.source.slug}: unknown chart type "${type}"`);
  return chartLines(
    readChartFile(context.source.dir, attribute(node, "src"), type)
  )
    .map((line) => `- ${line}`)
    .join("\n");
};

const innerOf = (context: Context, node: SourceNode): string => {
  const children = node.children ?? [];
  const first = children[0];
  const last = children.at(-1);
  return first === undefined || last === undefined
    ? ""
    : dedent(spliced(context, children, startOf(first), endOf(last)));
};

const jsxFallback = (
  context: Context,
  node: SourceNode,
  block: boolean
): string => {
  switch (node.name ?? "") {
    case "Chart": {
      return [attribute(node, "caption"), chartList(context, node)]
        .filter((part) => part !== "")
        .join("\n\n");
    }
    case "Diagram": {
      return [attribute(node, "caption"), diagramText(attribute(node, "name"))]
        .filter((part) => part !== "")
        .join("\n\n");
    }
    case "Figure": {
      const image = `![${escapeAlt(attribute(node, "alt"))}](${context.imageUrl(attribute(node, "src"))})`;
      const caption = attribute(node, "caption");
      return caption === "" ? image : `${image}\n\n*${caption}*`;
    }
    case "Note": {
      const inner = innerOf(context, node);
      return block ? quote(inner) : inner;
    }
    default: {
      return innerOf(context, node);
    }
  }
};

const linkTypes = new Set(["definition", "link"]);

const isRelativeLink = (node: SourceNode): boolean =>
  linkTypes.has(node.type) && node.url !== undefined && !URL.canParse(node.url);

const absoluteLink = (context: Context, node: SourceNode): string => {
  const target = absoluteUrl(node.url ?? "", context.source.meta.url);
  const title =
    typeof node.title === "string"
      ? ` "${node.title.replaceAll('"', String.raw`\"`)}"`
      : "";
  if (node.type === "definition") {
    return `[${node.label ?? ""}]: ${target}${title}`;
  }
  const children = node.children ?? [];
  const first = children[0];
  const last = children.at(-1);
  const text =
    first === undefined || last === undefined
      ? ""
      : spliced(context, children, startOf(first), endOf(last));
  return `[${text}](${target}${title})`;
};

const isLoneJsx = (node: SourceNode): boolean => {
  const children = node.children ?? [];
  const [only] = children;
  return (
    children.length === 1 &&
    node.type === "paragraph" &&
    only?.type === "mdxJsxTextElement"
  );
};

const rewrite = (context: Context, node: SourceNode): string => {
  const [only] = node.children ?? [];
  if (only !== undefined && isLoneJsx(node)) {
    return jsxFallback(context, only, true);
  }
  if (jsxTypes.has(node.type)) {
    return jsxFallback(context, node, node.type === "mdxJsxFlowElement");
  }
  if (droppedTypes.has(node.type)) {
    return "";
  }
  if (isRelativeLink(node)) {
    return absoluteLink(context, node);
  }
  return node.type === "image" && node.url !== undefined
    ? `![${escapeAlt(node.alt ?? "")}](${context.imageUrl(node.url)})`
    : spliced(context, node.children ?? [], startOf(node), endOf(node));
};

const spliced = (
  context: Context,
  children: SourceNode[],
  start: number,
  end: number
): string => {
  let output = "";
  let cursor = start;
  for (const child of children) {
    output += context.body.slice(cursor, startOf(child));
    output += rewrite(context, child);
    cursor = endOf(child);
  }
  return output + context.body.slice(cursor, end);
};

const plainBody = (source: PostSource, imageUrl: ImageUrl): string => {
  const tree = parseMdx(source.body);
  const context = { body: source.body, imageUrl, source };
  return spliced(context, tree.children ?? [], 0, source.body.length)
    .replaceAll(/\n{3,}/g, "\n\n")
    .trim();
};

export const toMarkdown = (source: PostSource, imageUrl: ImageUrl): string => {
  const { meta } = source;
  const header = [
    `# ${meta.title}`,
    "",
    `URL: ${meta.url}`,
    `Published: ${meta.date}`,
    ...(meta.updated === undefined ? [] : [`Updated: ${meta.updated}`]),
    `Tags: ${meta.tags.join(", ")}`,
    "",
    meta.description,
  ];
  return `${header.join("\n")}\n\n${plainBody(source, imageUrl)}\n`;
};

const linkProperties = ["href", "src"] as const;

const rehypeAbsolute =
  ({ base }: { base: string }) =>
  (tree: Root): void => {
    visit(tree, "element", (node: Element) => {
      for (const key of linkProperties) {
        const value = node.properties[key];
        if (typeof value === "string" && value !== "") {
          node.properties[key] = absoluteUrl(value, base);
        }
      }
    });
  };

export const toFeedHtml = (source: PostSource, imageUrl: ImageUrl): string =>
  String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeAbsolute, { base: source.meta.url })
      .use(rehypeStringify)
      .processSync(plainBody(source, imageUrl))
  ).replaceAll("]]>", "]]&#x3E;");
