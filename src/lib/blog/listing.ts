import { blogUrl } from "./metadata.ts";
import { laterPages, pageHref, pageSlice } from "./pagination.ts";
import { type PostMeta } from "./schema.ts";
import { findTag, postsTagged, type TagEntry, tagIndex } from "./tags.ts";

export interface Listing {
  base: string;
  count: number;
  page: number;
  posts: PostMeta[];
  tag: TagEntry | undefined;
  tags: TagEntry[];
  total: number;
  url: string;
}

export const blogListing = (
  posts: readonly PostMeta[],
  page: number
): Listing | undefined => {
  const slice = pageSlice(posts, page);
  if (slice === undefined) return undefined;
  return {
    base: "/blog",
    count: slice.count,
    page,
    posts: slice.items,
    tag: undefined,
    tags: tagIndex(posts),
    total: posts.length,
    url: pageHref(blogUrl, page),
  };
};

export const tagListing = (
  posts: readonly PostMeta[],
  slug: string,
  page: number
): Listing | undefined => {
  const tag = findTag(posts, slug);
  if (tag === undefined) return undefined;
  const slice = pageSlice(postsTagged(posts, slug), page);
  if (slice === undefined) return undefined;
  return {
    base: `/blog/tag/${slug}`,
    count: slice.count,
    page,
    posts: slice.items,
    tag,
    tags: tagIndex(posts),
    total: tag.count,
    url: pageHref(`${blogUrl}/tag/${slug}`, page),
  };
};

export const blogPageParams = (
  posts: readonly PostMeta[]
): Array<{ n: string }> =>
  laterPages(posts.length).map((page) => ({ n: String(page) }));

export const tagParams = (posts: readonly PostMeta[]): Array<{ tag: string }> =>
  tagIndex(posts).map((tag) => ({ tag: tag.slug }));

export const tagPageParams = (
  posts: readonly PostMeta[]
): Array<{ n: string; tag: string }> =>
  tagIndex(posts).flatMap((tag) =>
    laterPages(tag.count).map((page) => ({ n: String(page), tag: tag.slug }))
  );
