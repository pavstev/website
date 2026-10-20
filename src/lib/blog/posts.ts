import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { VFile } from "vfile";
import { matter } from "vfile-matter";

import { personalData } from "../personal.ts";
import { type BuildEnv, builtInstant, fixturesEnabled } from "./build-env.ts";
import { fixtureRoot } from "./fixture-posts.ts";
import { modifiedOf, newestFirst } from "./modified.ts";
import { readingOf } from "./reading.ts";
import { isScheduled } from "./schedule.ts";
import { frontmatterSchema, type PostMeta } from "./schema.ts";
import { isSlug } from "./slug.ts";

const blogDir = "content/blog";
const reservedSlugs = new Set(["page", "tag"]);

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

const fail = (file: string, field: string, message: string): Error =>
  new Error(`${file}: ${field}: ${message}`);

const readSource = (root: string, slug: string): PostSource => {
  const relative = `${blogDir}/${slug}/index.mdx`;
  if (!isSlug(slug)) {
    throw fail(relative, "slug", "use lowercase letters, digits and dashes");
  }
  if (reservedSlugs.has(slug)) {
    throw fail(relative, "slug", `"${slug}" is a blog route, pick another`);
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
  const reading = readingOf(body);
  return {
    body,
    dir,
    meta: {
      ...parsed.data,
      readingMinutes: reading.minutes,
      slug,
      url: `${personalData.website}/blog/${slug}`,
      wordCount: reading.words,
    },
    slug,
  };
};

const readDir = (root: string): PostSource[] => {
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

export const readPostSources = (
  root: string = process.cwd(),
  env: BuildEnv = process.env
): PostSource[] => [
  ...readDir(root),
  ...(fixturesEnabled(env) ? readDir(path.join(root, fixtureRoot)) : []),
];

const byDateThenTitle = (a: PostMeta, b: PostMeta): number =>
  newestFirst(a.date, b.date) || a.title.localeCompare(b.title, "en");

export const visibleSources = (
  { drafts, now = builtInstant() ?? new Date() }: DraftOptions,
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
  posts.map((post) => modifiedOf(post)).toSorted(newestFirst)[0];
