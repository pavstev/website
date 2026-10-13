import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import * as z from "zod";

import { personalData } from "../personal.ts";
import { type PostSource } from "./posts.ts";

export const mediaManifestPath = ".blog/media.json";

export const mediaWidths = [480, 768, 1344];

export interface MediaEntry {
  avif: string[];
  blur: string;
  fallback: string;
  height: number;
  webp: string[];
  width: number;
  widths: number[];
}

const mediaEntrySchema: z.ZodType<MediaEntry> = z.object({
  avif: z.array(z.string()),
  blur: z.string(),
  fallback: z.string(),
  height: z.number(),
  webp: z.array(z.string()),
  width: z.number(),
  widths: z.array(z.number()),
});

const manifestSchema = z.record(z.string(), mediaEntrySchema);

const external = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

export const contentHash = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex").slice(0, 8);

export const hashName = (
  name: string,
  bytes: Uint8Array,
  width: number,
  extension: string
): string => `${name}.${contentHash(bytes)}.${String(width)}.${extension}`;

export const imageWidths = (sourceWidth: number): number[] => [
  ...new Set(mediaWidths.map((width) => Math.min(width, sourceWidth))),
];

export const shareKey = (slug: string): string => `${slug}/share`;

export const cropSpecs = [
  { height: 1080, name: "16x9", width: 1920 },
  { height: 1200, name: "4x3", width: 1600 },
  { height: 1200, name: "1x1", width: 1200 },
] as const;

export const cropKey = (slug: string, name: string): string =>
  `${slug}/crop-${name}`;

const localFile = (src: string): string | undefined =>
  src === "" || src.startsWith("/") || external.test(src)
    ? undefined
    : src.replace(/^(?:\.\/)+/, "");

let manifest: Record<string, MediaEntry> | undefined;

export const readMedia = (): Record<string, MediaEntry> => {
  if (manifest === undefined) {
    const file = path.join(process.cwd(), mediaManifestPath);
    manifest = existsSync(file)
      ? manifestSchema.parse(JSON.parse(readFileSync(file, "utf8")))
      : {};
  }
  return manifest;
};

export const mediaEntry = (
  slug: string,
  src: string
): MediaEntry | undefined => {
  const file = localFile(src);
  return file === undefined ? undefined : readMedia()[`${slug}/${file}`];
};

export const mediaPath = (slug: string, src: string): string => {
  const file = localFile(src);
  return file === undefined
    ? src
    : (mediaEntry(slug, file)?.fallback ?? `/blog-media/${slug}/${file}`);
};

export const absoluteUrl = (href: string, base: string): string =>
  new URL(href, base).href;

export const mediaUrl = (slug: string, src: string): string =>
  absoluteUrl(mediaPath(slug, src), personalData.website);

export const shareImageUrl = (
  slug: string,
  site: string,
  media: Record<string, MediaEntry> = readMedia()
): string | undefined => {
  const entry = media[shareKey(slug)];
  return entry === undefined ? undefined : absoluteUrl(entry.fallback, site);
};

export interface CropImage {
  height: number;
  url: string;
  width: number;
}

export const postCrops = (
  slug: string,
  site: string,
  media: Record<string, MediaEntry> = readMedia()
): CropImage[] =>
  cropSpecs
    .map((spec) => media[cropKey(slug, spec.name)])
    .filter((entry) => entry !== undefined)
    .map((entry) => ({
      height: entry.height,
      url: absoluteUrl(entry.fallback, site),
      width: entry.width,
    }));

interface SourceNode {
  attributes?: unknown[];
  children?: SourceNode[];
  name?: null | string | undefined;
  type: string;
  url?: string;
}

const srcAttribute = z.object({
  name: z.literal("src"),
  type: z.literal("mdxJsxAttribute"),
  value: z.string(),
});

const imageTags = new Set(["Figure", "img"]);

const nodeImage = (node: SourceNode): string | undefined => {
  if (node.type === "image") {
    return node.url;
  }
  if (imageTags.has(node.name ?? "")) {
    const attributes = node.attributes ?? [];
    for (const item of attributes) {
      const parsed = srcAttribute.safeParse(item);
      if (parsed.success) {
        return parsed.data.value;
      }
    }
  }
  return undefined;
};

const collect = (node: SourceNode, found: Set<string>): void => {
  const file = localFile(nodeImage(node) ?? "");
  if (file !== undefined) {
    found.add(file);
  }
  const children = node.children ?? [];
  for (const child of children) {
    collect(child, found);
  }
};

export const postImages = (source: PostSource): string[] => {
  const tree: SourceNode = unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkGfm)
    .parse(source.body);
  const found = new Set<string>();
  collect(tree, found);
  const files = [...found];
  for (const file of files) {
    if (!existsSync(path.join(source.dir, file))) {
      throw new Error(
        `content/blog/${source.slug}/index.mdx: image "${file}" not found`
      );
    }
  }
  return files;
};
