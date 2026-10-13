import { en } from "../i18n.ts";
import { personalData } from "../personal.ts";
import { shareImageUrl } from "./media.ts";
import { modifiedOf } from "./modified.ts";
import { toFeedHtml } from "./plain.ts";
import { lastModified, listSources } from "./posts.ts";
import { type PostMeta } from "./schema.ts";

export interface FeedPost {
  html: string;
  meta: PostMeta;
}

export interface FeedPostWithMarkdown extends FeedPost {
  image?: string | undefined;
  markdownUrl: string;
}

interface JsonFeed {
  authors: Array<{ name: string; url: string }>;
  description: string;
  feed_url: string;
  home_page_url: string;
  items: JsonFeedItem[];
  title: string;
  version: string;
}

interface JsonFeedItem {
  _markdown_url: string;
  content_html: string;
  date_modified: string;
  date_published: string;
  id: string;
  image?: string;
  summary: string;
  tags: string[];
  title: string;
  url: string;
}

const xmlEscapes: Record<string, string> = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&apos;",
  "<": "&lt;",
  ">": "&gt;",
};

const xmlAllowed = (code: number): boolean =>
  code === 0x9 ||
  code === 0xa ||
  code === 0xd ||
  (code >= 0x20 &&
    !(code >= 0xd8_00 && code <= 0xdf_ff) &&
    code !== 0xff_fe &&
    code !== 0xff_ff);

const xmlSafe = (text: string): string => {
  let safe = "";
  for (const char of text) {
    if (xmlAllowed(char.codePointAt(0) ?? 0)) safe += char;
  }
  return safe;
};

export const escapeXml = (text: string): string =>
  xmlSafe(text).replaceAll(/["&'<>]/g, (char) => xmlEscapes[char] ?? char);

const cdata = (text: string): string =>
  `<![CDATA[${xmlSafe(text).replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;

export const rfc822 = (iso: string): string =>
  new Date(`${iso.slice(0, 19)}Z`)
    .toUTCString()
    .replace(/GMT$/u, () => iso.slice(19).replace(":", ""));

const newest = (posts: readonly FeedPost[]): string | undefined =>
  lastModified(posts.map((post) => post.meta));

const rssItem = ({ html, meta }: FeedPost): string =>
  [
    "    <item>",
    `      <title>${escapeXml(meta.title)}</title>`,
    `      <link>${escapeXml(meta.url)}</link>`,
    `      <guid isPermaLink="true">${escapeXml(meta.url)}</guid>`,
    `      <pubDate>${rfc822(meta.date)}</pubDate>`,
    `      <description>${escapeXml(meta.description)}</description>`,
    ...meta.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`),
    `      <content:encoded>${cdata(html)}</content:encoded>`,
    "    </item>",
  ].join("\n");

export const rssXml = (posts: readonly FeedPost[], site: string): string => {
  const latest = newest(posts);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">',
    "  <channel>",
    `    <title>${escapeXml(en.blog.blogName)}</title>`,
    `    <link>${escapeXml(`${site}/blog`)}</link>`,
    `    <description>${escapeXml(en.blog.metaDescription)}</description>`,
    "    <language>en</language>",
    ...(latest === undefined
      ? []
      : [`    <lastBuildDate>${rfc822(latest)}</lastBuildDate>`]),
    `    <atom:link href="${escapeXml(`${site}/blog/feed.xml`)}" rel="self" type="application/rss+xml"/>`,
    ...posts.map((post) => rssItem(post)),
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
};

export const jsonFeed = (
  posts: readonly FeedPostWithMarkdown[],
  site: string
): JsonFeed => ({
  authors: [{ name: personalData.name, url: site }],
  description: en.blog.metaDescription,
  feed_url: `${site}/blog/feed.json`,
  home_page_url: `${site}/blog`,
  items: posts.map(({ html, image, markdownUrl, meta }) => ({
    _markdown_url: markdownUrl,
    content_html: html,
    date_modified: modifiedOf(meta),
    date_published: meta.date,
    id: meta.url,
    ...(image !== undefined && { image }),
    summary: meta.description,
    tags: meta.tags,
    title: meta.title,
    url: meta.url,
  })),
  title: en.blog.blogName,
  version: "https://jsonfeed.org/version/1.1",
});

export const loadFeedPosts = (
  options: { drafts: boolean },
  site: string,
  root?: string
): FeedPostWithMarkdown[] =>
  listSources(options, root).map((source) => ({
    html: toFeedHtml(source),
    image: shareImageUrl(source.slug, site),
    markdownUrl: `${site}/blog/${source.slug}.md`,
    meta: source.meta,
  }));
