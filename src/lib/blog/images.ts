import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import * as z from "zod";

import { parseMdx, type SourceNode } from "./mdx-tree.ts";
import { type PostSource } from "./posts.ts";
import { type PostMeta } from "./schema.ts";
import { postSlug } from "./slug.ts";

export const imageWidths = [480, 768, 1344];

export const coverNames = ["cover.webp", "cover.png", "cover.jpg"];

export const cropSpecs = [
  { height: 1080, name: "16x9", width: 1920 },
  { height: 1200, name: "4x3", width: 1600 },
  { height: 1200, name: "1x1", width: 1200 },
] as const;

export const shareSize = { height: 630, width: 1200 };

const blurWidth = 16;

const external = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

export const absoluteUrl = (href: string, base: string): string =>
  new URL(href, base).href;

export const localFile = (src: string): string | undefined =>
  src === "" || src.startsWith("/") || external.test(src)
    ? undefined
    : src.replace(/^(?:\.\/)+/, "");

export const shareImagePath = (slug: string): string =>
  `/blog/${slug}/share.png`;

export const shareImageUrl = (
  meta: Pick<PostMeta, "readingMinutes" | "slug" | "title" | "updated">
): string => {
  const drawn = [meta.title, meta.readingMinutes, meta.updated ?? ""].join(
    "\n"
  );
  const version = createHash("sha256")
    .update(drawn)
    .digest("base64url")
    .slice(0, 10);
  return `${shareImagePath(meta.slug)}?v=${version}`;
};

export const imageKeys = (pathname: string, file: string): string[] => {
  const page = pathname.replace(/\.html$/u, "");
  const slug = postSlug(page);
  return page === "/about"
    ? [`/content/about/${file}`]
    : slug === undefined
      ? []
      : [
          `/content/blog/${slug}/${file}`,
          `/blog-fixtures/content/blog/${slug}/${file}`,
        ];
};

export const blurOf = async (key: string): Promise<string> => {
  const file = path.join(process.cwd(), key);
  const bytes = await sharp(await readFile(file))
    .resize({ width: blurWidth })
    .webp()
    .toBuffer();
  return `data:image/webp;base64,${bytes.toString("base64")}`;
};

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

export const postImages = (source: Pick<PostSource, "body">): string[] => {
  const found = new Set<string>();
  collect(parseMdx(source.body), found);
  return [...found];
};
