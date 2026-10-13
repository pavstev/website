import { en } from "../i18n.ts";
import { personalData } from "../personal.ts";
import { readMedia, shareKey } from "./media.ts";
import { type PostMeta } from "./schema.ts";

export const blogUrl = `${personalData.website}/blog`;

export const feedTypes = {
  "application/feed+json": [
    { title: en.blog.blogName, url: "/blog/feed.json" },
  ],
  "application/rss+xml": [{ title: en.blog.blogName, url: "/blog/feed.xml" }],
};

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
