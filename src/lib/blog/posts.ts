import type { CollectionEntry } from "astro:content";

import path from "node:path";

import { personalData } from "../personal.ts";
import { builtInstant } from "./build-env.ts";
import { newestFirst } from "./modified.ts";
import { readingOf } from "./reading.ts";
import { isScheduled } from "./schedule.ts";
import { type PostMeta } from "./schema.ts";
import { isSlug } from "./slug.ts";

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

const slugError = (file: string, message: string): Error =>
  new Error(`${file}: slug: ${message}`);

export const sourceOf = (
  entry: Pick<CollectionEntry<"blog">, "body" | "data" | "filePath" | "id">
): PostSource => {
  const { filePath = "", id: slug } = entry;
  if (!isSlug(slug)) {
    throw slugError(filePath, "use lowercase letters, digits and dashes");
  }
  if (reservedSlugs.has(slug)) {
    throw slugError(filePath, `"${slug}" is a blog route, pick another`);
  }
  const body = entry.body ?? "";
  const reading = readingOf(body);
  return {
    body,
    dir: path.resolve(path.dirname(filePath)),
    meta: {
      ...entry.data,
      readingMinutes: reading.minutes,
      slug,
      url: `${personalData.website}/blog/${slug}`,
      wordCount: reading.words,
    },
    slug,
  };
};

const outsideAstro = (error: unknown): boolean =>
  error instanceof Error &&
  "code" in error &&
  error.code === "ERR_UNSUPPORTED_ESM_URL_SCHEME";

const loadSources = async (): Promise<PostSource[]> => {
  try {
    const { getCollection } = await import("astro:content");
    const entries = await getCollection("blog");
    return entries.map((entry) => sourceOf(entry));
  } catch (error) {
    if (outsideAstro(error)) return [];
    throw error;
  }
};

const allSources = await loadSources();

const byDateThenTitle = (a: PostMeta, b: PostMeta): number =>
  newestFirst(a.date, b.date) || a.title.localeCompare(b.title, "en");

export const listSources = (
  { drafts, now = builtInstant() ?? new Date() }: DraftOptions,
  sources: readonly PostSource[] = allSources
): PostSource[] =>
  sources
    .filter(
      (source) =>
        drafts || !(source.meta.draft || isScheduled(source.meta.date, now))
    )
    .toSorted((a, b) => byDateThenTitle(a.meta, b.meta));

export const listPosts = (
  options: DraftOptions,
  sources: readonly PostSource[] = allSources
): PostMeta[] => listSources(options, sources).map((source) => source.meta);

export const findPost = (
  slug: string,
  options: DraftOptions,
  sources: readonly PostSource[] = allSources
): PostSource | undefined =>
  listSources(options, sources).find((source) => source.slug === slug);
