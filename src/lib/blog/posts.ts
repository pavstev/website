import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { VFile } from "vfile";
import { matter } from "vfile-matter";

import { personalData } from "../personal.ts";
import { modifiedOf } from "./modified.ts";
import { isScheduled } from "./schedule.ts";
import { frontmatterSchema, type PostMeta } from "./schema.ts";
import { isSlug } from "./slug.ts";

const blogDir = "content/blog";

export interface PostSource {
  body: string;
  dir: string;
  meta: PostMeta;
  slug: string;
}

interface DraftOptions {
  drafts: boolean;
  now?: Date;
}

const wordsPerMinute = 230;

const fenceOpen = /^ {0,3}(`{3,}|~{3,})/;
const jsxTagPattern = /<\/?[a-z][^<>]*>/gi;
const wordPattern = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;

const withoutFences = (body: string): string => {
  const kept: string[] = [];
  let fence = "";
  for (const line of body.split("\n")) {
    const marker = fenceOpen.exec(line)?.[1] ?? "";
    if (fence === "") {
      if (marker === "") {
        kept.push(line);
      } else {
        fence = marker;
      }
    } else if (marker.startsWith(fence) && line.trim() === marker) {
      fence = "";
    }
  }
  return kept.join("\n");
};

export const readingStats = (
  body: string
): { minutes: number; words: number } => {
  const prose = withoutFences(body).replaceAll(jsxTagPattern, " ");
  const words = prose.match(wordPattern)?.length ?? 0;
  return {
    minutes: Math.max(1, Math.round(words / wordsPerMinute)),
    words,
  };
};

const fail = (file: string, field: string, message: string): Error =>
  new Error(`${file}: ${field}: ${message}`);

const readSource = (root: string, slug: string): PostSource => {
  const relative = `${blogDir}/${slug}/index.mdx`;
  if (!isSlug(slug)) {
    throw fail(relative, "slug", "use lowercase letters, digits and dashes");
  }
  const dir = path.join(root, blogDir, slug);
  const file = new VFile({
    path: relative,
    value: readFileSync(path.join(dir, "index.mdx"), "utf8"),
  });
  try {
    matter(file, { strip: true });
  } catch (error) {
    throw fail(
      relative,
      "frontmatter",
      error instanceof Error ? error.message : String(error)
    );
  }
  const parsed = frontmatterSchema.safeParse(file.data["matter"]);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    const field = issue?.path.join(".") ?? "";
    throw fail(
      relative,
      field === "" ? "frontmatter" : field,
      issue?.message ?? "invalid"
    );
  }
  const body = String(file.value);
  const stats = readingStats(body);
  return {
    body,
    dir,
    meta: {
      ...parsed.data,
      readingMinutes: stats.minutes,
      slug,
      url: `${personalData.website}/blog/${slug}`,
      wordCount: stats.words,
    },
    slug,
  };
};

export const readPostSources = (root: string = process.cwd()): PostSource[] => {
  const base = path.join(root, blogDir);
  return existsSync(base)
    ? readdirSync(base, { withFileTypes: true })
        .filter(
          (entry) =>
            entry.isDirectory() &&
            existsSync(path.join(base, entry.name, "index.mdx"))
        )
        .map((entry) => readSource(root, entry.name))
    : [];
};

const byDateThenTitle = (a: PostMeta, b: PostMeta): number =>
  b.date.localeCompare(a.date) || a.title.localeCompare(b.title, "en");

export const visibleSources = (
  { drafts, now = new Date() }: DraftOptions,
  root?: string
): PostSource[] =>
  readPostSources(root).filter(
    (source) =>
      drafts || !(source.meta.draft || isScheduled(source.meta.date, now))
  );

export const listSources = (
  options: DraftOptions,
  root?: string
): PostSource[] =>
  visibleSources(options, root).toSorted((a, b) =>
    byDateThenTitle(a.meta, b.meta)
  );

export const listPosts = (options: DraftOptions, root?: string): PostMeta[] =>
  listSources(options, root).map((source) => source.meta);

export const findPost = (
  slug: string,
  options: DraftOptions,
  root?: string
): PostSource | undefined =>
  visibleSources(options, root).find((source) => source.slug === slug);

export const lastModified = (posts: readonly PostMeta[]): string | undefined =>
  posts
    .map((post) => modifiedOf(post))
    .toSorted((a, b) => b.localeCompare(a))[0];
