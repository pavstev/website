import { cvSchema } from "../src/lib/cv-schema.ts";

export const cv = cvSchema.parse({
  basics: {
    headline: "Backend engineer",
    location: "Vienna, Austria",
    name: "Ada Example",
  },
  experience: {
    items: [
      {
        company: "Acme",
        contributions: [
          { description: "Cut latency by half", title: "Speed" },
          { description: "Led four engineers", title: "" },
        ],
        from: "2020",
        overview: "Payments platform",
        position: "Tech lead",
        skills: ["Go", "Postgres"],
        to: "2024",
      },
    ],
  },
  skills: {
    items: [
      { keywords: ["Go", "Rust"], name: "Languages" },
      { keywords: [], name: "Empty" },
    ],
  },
  summary: "Builds systems people rely on.",
  updatedAt: "2026-10-08T00:00:00.000Z",
});

export const blogFeed = {
  items: [
    {
      _markdown_url: "https://ada.example/blog/newer.md",
      date_published: "2026-10-12T00:00:00Z",
      id: "https://ada.example/blog/newer",
      summary: "The newer post.",
      tags: ["One", "Two"],
      title: "Newer & better",
      url: "https://ada.example/blog/newer",
    },
    {
      _markdown_url: "https://ada.example/blog/older.md",
      date_published: "2026-10-01T00:00:00Z",
      id: "https://ada.example/blog/older",
      summary: "The older post.",
      tags: ["Three"],
      title: "Older",
      url: "https://ada.example/blog/older",
    },
  ],
};

export const fakeAssets = (answer: (url: string) => Response): Fetcher =>
  ({
    fetch: (url: string) => Promise.resolve(answer(url)),
  }) as unknown as Fetcher;

export const blogAssets = fakeAssets((url) => {
  if (url.endsWith("/blog/feed.json")) return Response.json(blogFeed);
  return url.endsWith("/blog/newer.md")
    ? new Response("# Newer & better\n\nBody.\n")
    : new Response("", { status: 404 });
});
