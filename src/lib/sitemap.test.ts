import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { modifiedOf } from "./blog/modified.ts";
import { postMeta, validSources } from "./blog/post-fixture.ts";
import { listPosts } from "./blog/posts.ts";
import { sitemapEntries, type SitemapEntry, sitemapXml } from "./sitemap.ts";

const site = "https://stevanpavlovic.com";

const liveXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
<url>
<loc>https://stevanpavlovic.com</loc>
<image:image>
<image:loc>https://stevanpavlovic.com/portraits/portrait-800.webp</image:loc>
</image:image>
<image:image>
<image:loc>https://stevanpavlovic.com/og-image.jpg</image:loc>
</image:image>
<lastmod>2026-10-12T09:03:17.113Z</lastmod>
</url>
<url>
<loc>https://stevanpavlovic.com/blog</loc>
<lastmod>2026-10-13T12:30:00+02:00</lastmod>
</url>
<url>
<loc>https://stevanpavlovic.com/blog/how-i-built-this-website</loc>
<image:image>
<image:loc>https://stevanpavlovic.com/blog-media/how-i-built-this-website/share.8d8a8d22.png</image:loc>
</image:image>
<lastmod>2026-10-13T12:00:00+02:00</lastmod>
</url>
<url>
<loc>https://stevanpavlovic.com/blog/how-i-use-ai</loc>
<image:image>
<image:loc>https://stevanpavlovic.com/blog-media/how-i-use-ai/share.fe974c7d.png</image:loc>
</image:image>
<lastmod>2026-10-13T12:30:00+02:00</lastmod>
</url>
</urlset>
`;

const urlBlocks = (xml: string): string[] =>
  xml
    .matchAll(/<url>\n([\s\S]*?)<\/url>/g)
    .map((m) => m[1] ?? "")
    .toArray();

const childTags = (block: string): string[] =>
  block
    .matchAll(/^<([a-z:]+)>/gm)
    .map((m) => m[1] ?? "")
    .filter((tag) => tag !== "image:loc")
    .toArray();

const parseEntries = (xml: string): SitemapEntry[] =>
  urlBlocks(xml).map((block) => ({
    images: block
      .matchAll(/<image:loc>(.*?)<\/image:loc>/g)
      .map((m) => m[1] ?? "")
      .toArray(),
    lastmod: /<lastmod>(.*?)<\/lastmod>/.exec(block)?.[1],
    loc: /<loc>(.*?)<\/loc>/.exec(block)?.[1] ?? "",
  }));

const sorted = (entries: readonly SitemapEntry[]): SitemapEntry[] =>
  entries.map((entry) => ({
    ...entry,
    images: entry.images.toSorted((a, b) => a.localeCompare(b)),
  }));

describe("sitemapXml", () => {
  const entries: SitemapEntry[] = [
    {
      images: ["https://x.test/a.png", "https://x.test/b.png"],
      lastmod: "2026-10-12T09:03:17.113Z",
      loc: "https://x.test",
    },
    { images: [], lastmod: "2026-10-13", loc: "https://x.test/blog" },
  ];

  it("writes loc, lastmod, then the images in every url", () => {
    const blocks = urlBlocks(sitemapXml(entries));
    assert.equal(blocks.length, 2);
    assert.deepEqual(childTags(blocks[0] ?? ""), [
      "loc",
      "lastmod",
      "image:image",
      "image:image",
    ]);
    assert.deepEqual(childTags(blocks[1] ?? ""), ["loc", "lastmod"]);
  });

  it("declares the sitemap and image namespaces", () => {
    const xml = sitemapXml(entries);
    assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset /);
    assert.match(
      xml,
      /xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/
    );
    assert.match(
      xml,
      /xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1"/
    );
    assert.ok(xml.endsWith("</urlset>\n"));
  });

  it("escapes &, < and > in every value", () => {
    const xml = sitemapXml([
      {
        images: ["https://x.test/i.png?a=1&b=<2>"],
        lastmod: "a&b",
        loc: "https://x.test/?q=1&r=<x>",
      },
    ]);
    assert.ok(xml.includes("<loc>https://x.test/?q=1&amp;r=&lt;x&gt;</loc>"));
    assert.ok(xml.includes("<lastmod>a&amp;b</lastmod>"));
    assert.ok(
      xml.includes(
        "<image:loc>https://x.test/i.png?a=1&amp;b=&lt;2&gt;</image:loc>"
      )
    );
  });

  it("leaves lastmod out when an entry has none", () => {
    const xml = sitemapXml([{ images: [], lastmod: undefined, loc: site }]);
    assert.doesNotMatch(xml, /lastmod/);
  });

  it("keeps the entries of the live sitemap and only changes the order", () => {
    const rebuilt = sitemapXml(parseEntries(liveXml));
    assert.deepEqual(
      sorted(parseEntries(rebuilt)),
      sorted(parseEntries(liveXml))
    );
    assert.notEqual(rebuilt, liveXml);
    for (const block of urlBlocks(rebuilt)) {
      const tags = childTags(block);
      assert.deepEqual(tags.slice(0, 2), ["loc", "lastmod"]);
    }
  });
});

describe("sitemapEntries", () => {
  const input = {
    homeImages: [`${site}/portraits/portrait-800.webp`, `${site}/og-image.jpg`],
    homeModified: "2026-10-12T09:03:17.113Z",
    imageFor: (slug: string): string | undefined =>
      slug === "alpha" ? `${site}/blog-media/alpha/share.png` : undefined,
    site,
    stories: [{ path: "/work/dotfiles", updatedAt: "2026-10-21" }],
  };

  it("lists the home page, the about and work pages, the story, the blog index and each visible post", () => {
    const entries = sitemapEntries({
      ...input,
      posts: listPosts({ drafts: false }, validSources),
    });
    assert.deepEqual(
      entries.map((entry) => entry.loc),
      [
        site,
        `${site}/about`,
        `${site}/work`,
        `${site}/work/dotfiles`,
        `${site}/blog`,
        `${site}/blog/alpha`,
        `${site}/blog/beta`,
        `${site}/blog/tag/two`,
        `${site}/blog/tag/one`,
      ]
    );
    assert.equal(entries[0]?.lastmod, "2026-10-12T09:03:17.113Z");
    assert.equal(entries[1]?.lastmod, "2026-10-12T09:03:17.113Z");
    assert.equal(entries[2]?.lastmod, "2026-10-12T09:03:17.113Z");
    assert.equal(entries[3]?.lastmod, "2026-10-21");
    assert.deepEqual(entries[5]?.images, [
      `${site}/blog-media/alpha/share.png`,
    ]);
    assert.deepEqual(entries[6]?.images, []);
  });

  it("leaves drafts out of a production build and keeps them in a draft build", () => {
    const production = sitemapXml(
      sitemapEntries({
        ...input,
        posts: listPosts({ drafts: false }, validSources),
      })
    );
    assert.doesNotMatch(production, /gamma/);
    const withDrafts = sitemapXml(
      sitemapEntries({
        ...input,
        posts: listPosts({ drafts: true }, validSources),
      })
    );
    assert.match(withDrafts, /\/blog\/gamma</);
  });

  it("uses the newest post date for the blog index", () => {
    const posts = listPosts({ drafts: false }, validSources);
    const entries = sitemapEntries({ ...input, posts });
    assert.equal(entries[4]?.loc, `${site}/blog`);
    assert.equal(entries[4]?.lastmod, "2026-10-13T07:45:00+02:00");
    assert.ok(posts.some((post) => modifiedOf(post) === entries[4]?.lastmod));
  });

  it("lists later pages and tag pages with their newest post as lastmod", () => {
    const many = Array.from({ length: 21 }, (_, index) =>
      postMeta({
        date: `2025-01-${String(index + 1).padStart(2, "0")}T10:00:00+01:00`,
        slug: `p-${String(index)}`,
        tags: index < 11 ? ["Next.js", "AI"] : ["AI"],
        url: `${site}/blog/p-${String(index)}`,
      })
    ).toReversed();
    const entries = sitemapEntries({ ...input, posts: many });
    const listings = entries.slice(5 + many.length);
    assert.deepEqual(
      listings.map((entry) => [entry.loc, entry.lastmod]),
      [
        [`${site}/blog/page/2`, "2025-01-11T10:00:00+01:00"],
        [`${site}/blog/page/3`, "2025-01-01T10:00:00+01:00"],
        [`${site}/blog/tag/ai`, "2025-01-21T10:00:00+01:00"],
        [`${site}/blog/tag/next-js`, "2025-01-11T10:00:00+01:00"],
        [`${site}/blog/tag/ai/page/2`, "2025-01-11T10:00:00+01:00"],
        [`${site}/blog/tag/ai/page/3`, "2025-01-01T10:00:00+01:00"],
        [`${site}/blog/tag/next-js/page/2`, "2025-01-01T10:00:00+01:00"],
      ]
    );
    assert.ok(entries.every((entry) => !entry.loc.endsWith("/page/1")));
  });

  it("omits the blog index when there are no posts", () => {
    const entries = sitemapEntries({ ...input, posts: [] });
    assert.deepEqual(
      entries.map((entry) => entry.loc),
      [site, `${site}/about`, `${site}/work`, `${site}/work/dotfiles`]
    );
  });
});
