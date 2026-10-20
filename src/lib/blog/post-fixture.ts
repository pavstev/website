import { type PostSource } from "./posts.ts";
import { type PostMeta } from "./schema.ts";

export const postMeta = (over: Partial<PostMeta> = {}): PostMeta => ({
  date: "2026-10-13T09:30:00+02:00",
  description: "About a post.",
  draft: false,
  readingMinutes: 1,
  slug: "a-post",
  tags: ["Test"],
  title: "A post",
  url: "https://stevanpavlovic.com/blog/a-post",
  wordCount: 3,
  ...over,
});

export const postSource = (
  body: string,
  dir = "/nowhere",
  over: Partial<PostMeta> = {}
): PostSource => {
  const meta = postMeta(over);
  return { body, dir, meta, slug: meta.slug };
};
