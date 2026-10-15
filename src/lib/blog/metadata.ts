import { en } from "../i18n.ts";
import { personalData } from "../personal.ts";
import { pageRobots } from "./build-env.ts";
import { postTitle } from "./format.ts";
import { blogLive } from "./live.ts";
import { readMedia, shareKey } from "./media.ts";
import { modifiedOf } from "./modified.ts";
import { type FeedLinks, type PageMetadata } from "./page-metadata.ts";
import { type PostMeta } from "./schema.ts";

export const blogUrl = `${personalData.website}/blog`;

const feedTypes = (): FeedLinks =>
  blogLive()
    ? {
        "application/feed+json": [
          { title: en.blog.blogName, url: "/blog/feed.json" },
        ],
        "application/rss+xml": [
          { title: en.blog.blogName, url: "/blog/feed.xml" },
        ],
      }
    : { "application/feed+json": [], "application/rss+xml": [] };

interface ShareImage {
  alt: string;
  height: number;
  type: string;
  url: string;
  width: number;
}

export const shareImage: ShareImage = {
  alt: en.meta.imageAlt,
  height: 630,
  type: "image/jpeg",
  url: "/og-image.jpg",
  width: 1200,
};

export const postShareImage = (post: PostMeta): ShareImage => {
  const entry = readMedia()[shareKey(post.slug)];
  return entry === undefined
    ? shareImage
    : {
        alt: post.title,
        height: entry.height,
        type: "image/png",
        url: entry.fallback,
        width: entry.width,
      };
};

interface ListMetadata {
  description: string;
  title: string;
  url: string;
}

export const listMetadata = ({
  description,
  title,
  url,
}: ListMetadata): PageMetadata => ({
  alternates: { canonical: url, types: feedTypes() },
  description,
  openGraph: {
    description,
    images: [shareImage],
    locale: "en_US",
    siteName: personalData.name,
    title,
    type: "website",
    url,
  },
  robots: pageRobots,
  title,
  twitter: {
    card: "summary_large_image",
    description,
    images: [{ alt: shareImage.alt, url: shareImage.url }],
    title,
  },
});

export const notFoundMetadata = ({
  description,
  title,
}: Omit<ListMetadata, "url">): PageMetadata => ({
  alternates: { types: feedTypes() },
  description,
  openGraph: {
    description,
    images: [shareImage],
    locale: "en_US",
    siteName: personalData.name,
    title,
    type: "website",
  },
  robots: {
    ...pageRobots,
    googleBot: { ...pageRobots.googleBot, index: false },
    index: false,
  },
  title,
  twitter: {
    card: "summary_large_image",
    description,
    images: [{ alt: shareImage.alt, url: shareImage.url }],
    title,
  },
});

export const postMetadata = (meta: PostMeta): PageMetadata => {
  const title = postTitle(meta.title);
  const image = postShareImage(meta);
  return {
    alternates: { canonical: meta.url, types: feedTypes() },
    description: meta.description,
    keywords: meta.tags,
    openGraph: {
      authors: [personalData.website],
      description: meta.description,
      images: [image],
      locale: "en_US",
      modifiedTime: modifiedOf(meta),
      publishedTime: meta.date,
      siteName: personalData.name,
      tags: meta.tags,
      title,
      type: "article",
      url: meta.url,
    },
    robots: pageRobots,
    title,
    twitter: {
      card: "summary_large_image",
      description: meta.description,
      images: [{ alt: image.alt, url: image.url }],
      title,
    },
  };
};
