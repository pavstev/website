import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";

import { listPosts } from "./blog/posts.ts";
import { sitemapEntries, type SitemapEntry, sitemapXml } from "./sitemap.ts";

const site = "https://stevanpavlovic.com";
const valid = path.join(import.meta.dirname, "blog", "fixtures", "valid");

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
<lastmod>2026-10-13</lastmod>
</url>
<url>
<loc>https://stevanpavlovic.com/blog/how-i-built-this-website</loc>
<image:image>
<image:loc>https://stevanpavlovic.com/blog-media/how-i-built-this-website/share.8d8a8d22.png</image:loc>
</image:image>
<lastmod>2026-10-13</lastmod>
</url>
<url>
<loc>https://stevanpavlovic.com/blog/how-i-use-ai</loc>
<image:image>
<image:loc>https://stevanpavlovic.com/blog-media/how-i-use-ai/share.fe974c7d.png</image:loc>
</image:image>
<lastmod>2026-10-13</lastmod>
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
  };

  it("lists the home page, the blog index and each visible post", () => {
    const entries = sitemapEntries({
      ...input,
      posts: listPosts({ drafts: false }, valid),
    });
    assert.deepEqual(
      entries.map((entry) => entry.loc),
      [site, `${site}/blog`, `${site}/blog/alpha`, `${site}/blog/beta`]
    );
    assert.equal(entries[0]?.lastmod, "2026-10-12T09:03:17.113Z");
    assert.deepEqual(entries[2]?.images, [
      `${site}/blog-media/alpha/share.png`,
    ]);
    assert.deepEqual(entries[3]?.images, []);
  });

  it("leaves drafts out of a production build and keeps them in a preview", () => {
    const production = sitemapXml(
      sitemapEntries({ ...input, posts: listPosts({ drafts: false }, valid) })
    );
    assert.doesNotMatch(production, /gamma/);
    const preview = sitemapXml(
      sitemapEntries({ ...input, posts: listPosts({ drafts: true }, valid) })
    );
    assert.match(preview, /\/blog\/gamma</);
  });

  it("uses the newest post date for the blog index", () => {
    const posts = listPosts({ drafts: false }, valid);
    const entries = sitemapEntries({ ...input, posts });
    const newest = posts
      .map((post) => post.updated ?? post.date)
      .toSorted((a, b) => b.localeCompare(a))[0];
    assert.equal(entries[1]?.lastmod, newest);
  });

  it("omits the blog index when there are no posts", () => {
    const entries = sitemapEntries({ ...input, posts: [] });
    assert.deepEqual(
      entries.map((entry) => entry.loc),
      [site]
    );
  });
});
