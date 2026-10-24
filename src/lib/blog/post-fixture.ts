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

const named = (slug: string, title: string): Partial<PostMeta> => ({
  slug,
  title,
  url: `https://stevanpavlovic.com/blog/${slug}`,
});

export const validSources: PostSource[] = [
  postSource(
    "## Start\n\nAlpha has a few words of prose.\n\n<Note>A short note.</Note>\n",
    "/valid/alpha",
    {
      ...named("alpha", "Alpha"),
      date: "2026-10-12T18:15:00+02:00",
      description: "The first fixture post.",
      tags: ["One", "Two"],
    }
  ),
  postSource(
    "Beta links to [the blog](/blog) and shows ![a photo](./photo.png).\n",
    "/valid/beta",
    {
      ...named("beta", "Beta"),
      date: "2026-10-12T08:00:00+02:00",
      description: "The second fixture post.",
      tags: ["Two"],
      updated: "2026-10-13T07:45:00+02:00",
    }
  ),
  postSource("Gamma is a draft.\n", "/valid/gamma", {
    ...named("gamma", "Gamma"),
    date: "2026-10-13T09:30:00+02:00",
    description: "A draft fixture post.",
    draft: true,
    tags: ["Three"],
  }),
];
