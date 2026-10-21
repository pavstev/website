import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { jsonFeed, loadFeedPosts, rfc822, rssXml } from "./feeds.ts";
import { type ImageUrl } from "./plain.ts";
import { postMeta, validSources } from "./post-fixture.ts";
import { type PostMeta } from "./schema.ts";

const site = "https://stevanpavlovic.com";

const meta = (over: Partial<PostMeta>): PostMeta =>
  postMeta({
    date: "2026-10-12T09:05:00+02:00",
    description: "A short description.",
    slug: "one",
    tags: ["Alpha"],
    title: "One",
    url: `${site}/blog/one`,
    wordCount: 10,
    ...over,
  });

const posts = [
  {
    html: "<p>Text with ]]&#x3E; inside</p>",
    meta: meta({
      slug: "two",
      tags: ["Beta", "Gamma"],
      title: "A & B <C>",
      updated: "2026-10-14T18:30:00+02:00",
      url: `${site}/blog/two`,
    }),
  },
  { html: "<p>First</p>", meta: meta({}) },
];

describe("rssXml", () => {
  const xml = rssXml(posts, site);

  it("declares the atom and content namespaces and a self link", () => {
    assert.match(xml, /xmlns:atom="http:\/\/www\.w3\.org\/2005\/Atom"/);
    assert.match(
      xml,
      /xmlns:content="http:\/\/purl\.org\/rss\/1\.0\/modules\/content\/"/
    );
    assert.match(
      xml,
      /<atom:link href="https:\/\/stevanpavlovic\.com\/blog\/feed\.xml" rel="self" type="application\/rss\+xml"\/>/
    );
  });

  it("escapes titles", () => {
    assert.match(xml, /<title>A &amp; B &lt;C&gt;<\/title>/);
  });

  it("drops characters that XML 1.0 forbids", () => {
    const forbidden = [0, 1, 11, 31].map((code) => String.fromCodePoint(code));
    const [nul = "", soh = "", vt = "", us = ""] = forbidden;
    const bad = rssXml(
      [
        {
          html: `<p>a${soh}b${vt}c</p>`,
          meta: meta({ title: `T${nul}i${us}tle` }),
        },
      ],
      site
    );
    assert.ok(bad.includes("<title>Title</title>"));
    assert.ok(bad.includes("<p>abc</p>"));
    for (const char of forbidden) assert.ok(!bad.includes(char));
  });

  it("splits ]]> inside CDATA", () => {
    const tricky = rssXml([{ html: "<p>a ]]> b</p>", meta: meta({}) }], site);
    assert.ok(tricky.includes("<![CDATA[<p>a ]]]]><![CDATA[> b</p>]]>"));
  });

  it("takes lastBuildDate from the newest updated or date, not the clock", () => {
    assert.match(
      xml,
      /<lastBuildDate>Wed, 14 Oct 2026 18:30:00 \+0200<\/lastBuildDate>/
    );
  });

  it("writes items with guid, pubDate, categories and description", () => {
    assert.match(
      xml,
      /<guid isPermaLink="true">https:\/\/stevanpavlovic\.com\/blog\/two<\/guid>/
    );
    assert.match(xml, /<pubDate>Mon, 12 Oct 2026 09:05:00 \+0200<\/pubDate>/);
    assert.match(xml, /<category>Beta<\/category>/);
    assert.match(xml, /<category>Gamma<\/category>/);
    assert.match(xml, /<description>A short description\.<\/description>/);
  });

  it("is well formed XML: balanced tags, escaped text, closed CDATA", () => {
    const tricky = rssXml(
      [{ html: "<p>a ]]> b & <i>c</i></p>", meta: posts[0]?.meta ?? meta({}) }],
      site
    );
    const stripped = tricky
      .replaceAll(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
      .replace(/^<\?xml[^>]*\?>/, "");
    const stack: string[] = [];
    const texts: string[] = [];
    const [lead = "", ...chunks] = stripped.split("<");
    texts.push(lead);
    for (const chunk of chunks) {
      const end = chunk.indexOf(">");
      assert.ok(end > 0);
      const tag = chunk.slice(0, end);
      texts.push(chunk.slice(end + 1));
      const name = tag.replace(/^\//, "").split(/\s/, 1)[0] ?? "";
      if (tag.endsWith("/")) {
        continue;
      }
      if (tag.startsWith("/")) {
        assert.equal(stack.pop(), name);
      } else {
        stack.push(name);
      }
    }
    assert.deepEqual(stack, []);
    assert.doesNotMatch(texts.join(""), />|&(?!(?:amp|lt|gt|quot|apos);)/);
  });

  it("has no items without posts", () => {
    assert.doesNotMatch(rssXml([], site), /<item>/);
  });
});

describe("rfc822", () => {
  it("keeps the written wall time and offset", () => {
    assert.equal(
      rfc822("2026-12-01T23:30:00+01:00"),
      "Tue, 01 Dec 2026 23:30:00 +0100"
    );
    assert.equal(
      rfc822("2026-10-13T09:30:00-05:00"),
      "Tue, 13 Oct 2026 09:30:00 -0500"
    );
  });
});

describe("jsonFeed", () => {
  const feed = jsonFeed(
    posts.map((post) => ({ ...post, markdownUrl: `${post.meta.url}.md` })),
    site
  );

  it("is JSON Feed 1.1 with the feed URL and an author", () => {
    assert.equal(feed.version, "https://jsonfeed.org/version/1.1");
    assert.equal(feed.feed_url, `${site}/blog/feed.json`);
    assert.equal(feed.home_page_url, `${site}/blog`);
    assert.deepEqual(feed.authors, [{ name: "Stevan Pavlović", url: site }]);
  });

  it("carries the share image only when a post has one", () => {
    const withImage = jsonFeed(
      [
        {
          html: "<p>First</p>",
          image: `${site}/blog-media/one/share.0123abcd.png`,
          markdownUrl: `${site}/blog/one.md`,
          meta: meta({}),
        },
      ],
      site
    );
    assert.equal(
      withImage.items[0]?.image,
      `${site}/blog-media/one/share.0123abcd.png`
    );
    assert.ok(!("image" in (feed.items[0] ?? {})));
  });

  it("carries date_modified and the markdown URL", () => {
    const [first, second] = feed.items;
    assert.equal(first?.date_modified, "2026-10-14T18:30:00+02:00");
    assert.equal(first?.date_published, "2026-10-12T09:05:00+02:00");
    assert.equal(second?.date_modified, "2026-10-12T09:05:00+02:00");
    assert.equal(first?._markdown_url, `${site}/blog/two.md`);
    assert.deepEqual(first?.tags, ["Beta", "Gamma"]);
    assert.equal(first?.id, `${site}/blog/two`);
    assert.equal(first?.title, "A & B <C>");
    assert.equal(first?.summary, "A short description.");
  });
});

const imageUrlOf = (): Promise<ImageUrl> => Promise.resolve((src) => src);

const loadValid = (drafts: boolean): ReturnType<typeof loadFeedPosts> =>
  loadFeedPosts({ drafts }, site, imageUrlOf, validSources);

describe("loadFeedPosts", () => {
  it("leaves drafts out of production feeds", async () => {
    const production = await loadValid(false);
    assert.deepEqual(
      production.map((post) => post.meta.slug),
      ["alpha", "beta"]
    );
    assert.doesNotMatch(JSON.stringify(jsonFeed(production, site)), /gamma/i);
    assert.doesNotMatch(rssXml(production, site), /gamma/i);
  });

  it("includes drafts in a preview", async () => {
    const preview = await loadValid(true);
    assert.deepEqual(
      preview.map((post) => post.meta.slug),
      ["gamma", "alpha", "beta"]
    );
  });

  it("renders feed HTML, the share image and the Markdown copy URL", async () => {
    const [first] = await loadValid(false);
    assert.ok(first?.image?.startsWith(`${site}/blog/alpha/share.png?v=`));
    assert.equal(first?.markdownUrl, `${site}/blog/alpha.md`);
    assert.match(first?.html ?? "", /<p>/);
  });
});
