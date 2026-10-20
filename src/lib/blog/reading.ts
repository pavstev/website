import { parseMdx, type SourceNode } from "./mdx-tree.ts";

const proseWordsPerMinute = 238;
const codeWordsPerMinute = 119;
const imageSeconds = 12;
const vizSeconds = 20;

const wordPattern = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
const jsxTypes = new Set(["mdxJsxFlowElement", "mdxJsxTextElement"]);
const skippedTypes = new Set([
  "definition",
  "footnoteReference",
  "html",
  "mdxFlowExpression",
  "mdxjsEsm",
  "mdxTextExpression",
  "yaml",
]);
const imageTags = new Set(["Figure"]);
const vizTags = new Set(["Chart", "Diagram"]);
const readTextProps = ["title", "caption"];

export interface Reading extends ReadingCounts {
  minutes: number;
  seconds: number;
  words: number;
}

export interface ReadingCounts {
  codeWords: number;
  images: number;
  proseWords: number;
  visuals: number;
}

const countWords = (text: string): number =>
  text.match(wordPattern)?.length ?? 0;

const textProp = (node: SourceNode, name: string): string => {
  const attributes = node.attributes ?? [];
  for (const item of attributes) {
    if (
      typeof item === "object" &&
      item !== null &&
      "name" in item &&
      "value" in item &&
      item.name === name &&
      typeof item.value === "string"
    ) {
      return item.value;
    }
  }
  return "";
};

const valueOf = (node: SourceNode): string => {
  const { value } = node as { value?: unknown };
  return typeof value === "string" ? value : "";
};

const visit = (node: SourceNode, counts: ReadingCounts): void => {
  if (skippedTypes.has(node.type)) return;
  if (node.type === "code") {
    counts.codeWords += countWords(valueOf(node));
    return;
  }
  if (node.type === "text" || node.type === "inlineCode") {
    counts.proseWords += countWords(valueOf(node));
    return;
  }
  if (node.type === "image" || node.type === "imageReference") {
    counts.images += 1;
    return;
  }
  if (jsxTypes.has(node.type)) {
    const name = node.name ?? "";
    if (imageTags.has(name)) counts.images += 1;
    if (vizTags.has(name)) counts.visuals += 1;
    for (const prop of readTextProps) {
      counts.proseWords += countWords(textProp(node, prop));
    }
  }
  const children = node.children ?? [];
  for (const child of children) visit(child, counts);
};

export const readingCounts = (body: string): ReadingCounts => {
  const counts: ReadingCounts = {
    codeWords: 0,
    images: 0,
    proseWords: 0,
    visuals: 0,
  };
  visit(parseMdx(body), counts);
  return counts;
};

const codeFactor = proseWordsPerMinute / codeWordsPerMinute;

export const readingTime = (counts: ReadingCounts): Reading => {
  const scaled =
    counts.proseWords * 60 +
    counts.codeWords * 60 * codeFactor +
    (counts.images * imageSeconds + counts.visuals * vizSeconds) *
      proseWordsPerMinute;
  return {
    ...counts,
    minutes: Math.max(1, Math.ceil(scaled / (proseWordsPerMinute * 60))),
    seconds: scaled / proseWordsPerMinute,
    words: counts.proseWords + counts.codeWords,
  };
};

export const readingOf = (body: string): Reading =>
  readingTime(readingCounts(body));
