import { type PostMeta } from "./schema.ts";

export interface TagEntry {
  count: number;
  name: string;
  slug: string;
}

export const tagSlug = (tag: string): string =>
  tag
    .normalize("NFKD")
    .replaceAll(/\p{M}/gu, "")
    .toLowerCase()
    .replaceAll(/[^a-z\d]+/gu, "-")
    .replaceAll(/^-|-$/gu, "");

export const tagHref = (tag: string): string => `/blog/tag/${tagSlug(tag)}`;

export const tagIndex = (posts: readonly PostMeta[]): TagEntry[] => {
  const entries = new Map<string, TagEntry>();
  for (const post of posts) {
    for (const name of post.tags) {
      const slug = tagSlug(name);
      if (slug === "") {
        throw new Error(
          `${post.slug}: tag "${name}" has no letters or digits for its URL`
        );
      }
      const known = entries.get(slug);
      if (known !== undefined && known.name !== name) {
        throw new Error(
          `Tags "${known.name}" and "${name}" (${post.slug}) both map to /blog/tag/${slug}: use one spelling`
        );
      }
      entries.set(slug, { count: (known?.count ?? 0) + 1, name, slug });
    }
  }
  return entries
    .values()
    .toArray()
    .toSorted(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name, "en")
    );
};

export const findTag = (
  posts: readonly PostMeta[],
  slug: string
): TagEntry | undefined => tagIndex(posts).find((tag) => tag.slug === slug);

export const postsTagged = (
  posts: readonly PostMeta[],
  slug: string
): PostMeta[] =>
  posts.filter((post) => post.tags.some((tag) => tagSlug(tag) === slug));
