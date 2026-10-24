import { escapeXml } from "./blog/feeds.ts";
import {
  blogListing,
  blogPageParams,
  tagListing,
  tagPageParams,
  tagParams,
} from "./blog/listing.ts";
import { lastModified, modifiedOf } from "./blog/modified.ts";
import { type PostMeta } from "./blog/schema.ts";
import { pagePaths } from "./blog/slug.ts";

export interface SitemapEntry {
  images: readonly string[];
  lastmod: string | undefined;
  loc: string;
}

export interface SitemapInput {
  homeImages: readonly string[];
  homeModified: string;
  imageFor: (slug: string) => string | undefined;
  posts: readonly PostMeta[];
  site: string;
  stories: ReadonlyArray<{ path: string; updatedAt: string }>;
}

const listingEntry = (
  listing: undefined | { posts: readonly PostMeta[]; url: string }
): SitemapEntry[] =>
  listing === undefined
    ? []
    : [
        {
          images: [],
          lastmod: lastModified(listing.posts),
          loc: listing.url,
        },
      ];

const listingEntries = (posts: readonly PostMeta[]): SitemapEntry[] => [
  ...blogPageParams(posts).flatMap(({ n }) =>
    listingEntry(blogListing(posts, Number(n)))
  ),
  ...tagParams(posts).flatMap(({ tag }) =>
    listingEntry(tagListing(posts, tag, 1))
  ),
  ...tagPageParams(posts).flatMap(({ n, tag }) =>
    listingEntry(tagListing(posts, tag, Number(n)))
  ),
];

export const sitemapEntries = ({
  homeImages,
  homeModified,
  imageFor,
  posts,
  site,
  stories,
}: SitemapInput): SitemapEntry[] => {
  const blogModified = lastModified(posts);
  return [
    { images: homeImages, lastmod: homeModified, loc: site },
    ...pagePaths.map((path) => ({
      images: [],
      lastmod: homeModified,
      loc: `${site}${path}`,
    })),
    ...stories.map((story) => ({
      images: [],
      lastmod: story.updatedAt,
      loc: `${site}${story.path}`,
    })),
    ...(blogModified === undefined
      ? []
      : [
          {
            images: [],
            lastmod: blogModified,
            loc: `${site}/blog`,
          },
        ]),
    ...posts.map((post) => {
      const image = imageFor(post.slug);
      return {
        images: image === undefined ? [] : [image],
        lastmod: modifiedOf(post),
        loc: post.url,
      };
    }),
    ...listingEntries(posts),
  ];
};

const urlXml = (entry: SitemapEntry): string[] => [
  "<url>",
  `<loc>${escapeXml(entry.loc)}</loc>`,
  ...(entry.lastmod === undefined
    ? []
    : [`<lastmod>${escapeXml(entry.lastmod)}</lastmod>`]),
  ...entry.images.map(
    (image) =>
      `<image:image>\n<image:loc>${escapeXml(image)}</image:loc>\n</image:image>`
  ),
  "</url>",
];

export const sitemapXml = (entries: readonly SitemapEntry[]): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...entries.flatMap((entry) => urlXml(entry)),
    "</urlset>",
    "",
  ].join("\n");
