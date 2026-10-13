import { escapeXml } from "./blog/feeds.ts";
import { lastModified } from "./blog/posts.ts";
import { type PostMeta } from "./blog/schema.ts";

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
}

export const sitemapEntries = ({
  homeImages,
  homeModified,
  imageFor,
  posts,
  site,
}: SitemapInput): SitemapEntry[] => {
  const blogModified = lastModified(posts);
  return [
    { images: homeImages, lastmod: homeModified, loc: site },
    ...(blogModified === undefined
      ? []
      : [{ images: [], lastmod: blogModified, loc: `${site}/blog` }]),
    ...posts.map((post) => {
      const image = imageFor(post.slug);
      return {
        images: image === undefined ? [] : [image],
        lastmod: post.updated ?? post.date,
        loc: post.url,
      };
    }),
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
