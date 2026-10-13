import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as z from "zod";

import { blogGraph, postGraph, serializeJsonLd } from "../structured-data.ts";
import { postMeta } from "./post-fixture.ts";
import { type PostMeta } from "./schema.ts";

const post = (slug: string, title: string, updated?: string): PostMeta =>
  postMeta({
    description: `About ${title}.`,
    readingMinutes: 10,
    slug,
    tags: ["WebGL", "Next.js"],
    title,
    ...(updated !== undefined && { updated }),
    url: `https://stevanpavlovic.com/blog/${slug}`,
    wordCount: 2300,
  });

const nodes = z.array(
  z.looseObject({ "@id": z.string().optional(), "@type": z.string() })
);
const ref = z.object({ "@id": z.string() });

const namedAuthor = {
  "@id": "https://stevanpavlovic.com/#person",
  "@type": "Person",
  name: "Stevan Pavlović",
  url: "https://stevanpavlovic.com",
};

const crumb = z.object({
  "@type": z.literal("ListItem"),
  item: z.string(),
  name: z.string(),
  position: z.number(),
});

const crumbsOf = (
  graph: z.infer<typeof nodes>
): Array<[number, string, string]> => {
  const lists = graph.filter((node) => node["@type"] === "BreadcrumbList");
  assert.equal(lists.length, 1);
  return z
    .array(crumb)
    .parse(lists[0]?.["itemListElement"])
    .map((item) => [item.position, item.name, item.item]);
};

describe("blogGraph", () => {
  it("has one Blog node with a ref to each post", () => {
    const graph = nodes.parse(
      blogGraph([post("one", "One"), post("two", "Two")])["@graph"]
    );
    const blogs = graph.filter((node) => node["@type"] === "Blog");
    assert.equal(blogs.length, 1);
    const [blog] = blogs;
    assert.equal(blog?.["@id"], "https://stevanpavlovic.com/blog#blog");
    const entries = nodes.parse(blog?.["blogPost"]);
    assert.deepEqual(
      entries.map((entry) => [
        entry["@id"],
        entry["@type"],
        entry["headline"],
        entry["url"],
        entry["datePublished"],
      ]),
      [
        [
          "https://stevanpavlovic.com/blog/one#post",
          "BlogPosting",
          "One",
          "https://stevanpavlovic.com/blog/one",
          "2026-10-13",
        ],
        [
          "https://stevanpavlovic.com/blog/two#post",
          "BlogPosting",
          "Two",
          "https://stevanpavlovic.com/blog/two",
          "2026-10-13",
        ],
      ]
    );
    assert.deepEqual(blog?.["author"], namedAuthor);
  });

  it("defines the WebSite node the Blog node points to", () => {
    const graph = nodes.parse(blogGraph([post("one", "One")])["@graph"]);
    const sites = graph.filter((node) => node["@type"] === "WebSite");
    assert.equal(sites.length, 1);
    const [site] = sites;
    assert.equal(site?.["@id"], "https://stevanpavlovic.com/#website");
    assert.equal(site?.["name"], "Stevan Pavlović");
    assert.equal(site?.["url"], "https://stevanpavlovic.com");
    const blog = graph.find((node) => node["@type"] === "Blog");
    assert.equal(ref.parse(blog?.["isPartOf"])["@id"], site?.["@id"]);
  });

  it("has a Home and Blog breadcrumb", () => {
    const graph = nodes.parse(blogGraph([post("one", "One")])["@graph"]);
    assert.deepEqual(crumbsOf(graph), [
      [1, "Stevan Pavlović", "https://stevanpavlovic.com"],
      [2, "Blog", "https://stevanpavlovic.com/blog"],
    ]);
  });
});

describe("postGraph", () => {
  const share = {
    height: 630,
    url: "https://stevanpavlovic.com/blog-media/one/share.png",
    width: 1200,
  };
  const crops = [
    {
      height: 1080,
      url: "https://stevanpavlovic.com/blog-media/one/crop-16x9.webp",
      width: 1920,
    },
    {
      height: 1200,
      url: "https://stevanpavlovic.com/blog-media/one/crop-4x3.webp",
      width: 1600,
    },
    {
      height: 1200,
      url: "https://stevanpavlovic.com/blog-media/one/crop-1x1.webp",
      width: 1200,
    },
  ];
  const image = [share, ...crops];

  it("describes the post as a BlogPosting", () => {
    const [node] = nodes.parse(
      postGraph(post("one", "One", "2026-10-20"), image)["@graph"]
    );
    assert.equal(node?.["@type"], "BlogPosting");
    assert.equal(node?.["@id"], "https://stevanpavlovic.com/blog/one#post");
    assert.equal(node?.["headline"], "One");
    assert.equal(node?.["datePublished"], "2026-10-13");
    assert.equal(node?.["dateModified"], "2026-10-20");
    assert.equal(node?.["description"], "About One.");
    assert.equal(node?.["url"], "https://stevanpavlovic.com/blog/one");
    assert.deepEqual(node?.["author"], namedAuthor);
    assert.deepEqual(node?.["publisher"], namedAuthor);
    assert.equal(
      ref.parse(node?.["isPartOf"])["@id"],
      "https://stevanpavlovic.com/blog#blog"
    );
    assert.equal(
      ref.parse(node?.["mainEntityOfPage"])["@id"],
      "https://stevanpavlovic.com/blog/one"
    );
    assert.deepEqual(
      node?.["image"],
      image.map((item) => ({
        "@type": "ImageObject",
        height: String(item.height),
        url: item.url,
        width: String(item.width),
      }))
    );
    assert.deepEqual(node?.["keywords"], ["WebGL", "Next.js"]);
    assert.equal(node?.["wordCount"], 2300);
    assert.equal(node?.["inLanguage"], "en");
  });

  it("has a Home, Blog and post breadcrumb", () => {
    const graph = nodes.parse(postGraph(post("one", "One"), image)["@graph"]);
    assert.deepEqual(crumbsOf(graph), [
      [1, "Stevan Pavlović", "https://stevanpavlovic.com"],
      [2, "Blog", "https://stevanpavlovic.com/blog"],
      [3, "One", "https://stevanpavlovic.com/blog/one"],
    ]);
  });

  it("round-trips through serializeJsonLd", () => {
    for (const graph of [
      postGraph(post("one", 'A <b> & "q"'), image),
      blogGraph([post("one", 'A <b> & "q"')]),
    ]) {
      const json = serializeJsonLd(graph);
      assert.ok(!json.includes("<"));
      assert.deepEqual(JSON.parse(json), graph);
    }
  });

  it("uses the publish date as the modified date without an update", () => {
    const [node] = nodes.parse(postGraph(post("one", "One"), image)["@graph"]);
    assert.equal(node?.["dateModified"], "2026-10-13");
  });

  it("lists the share image first, then the 16x9, 4x3 and 1x1 crops", () => {
    const [node] = nodes.parse(postGraph(post("one", "One"), image)["@graph"]);
    const urls = z
      .array(z.object({ url: z.string() }))
      .parse(node?.["image"])
      .map((item) => item.url);
    assert.equal(urls.length, 4);
    assert.deepEqual(
      urls,
      image.map((item) => item.url)
    );
  });

  it("never prints a raw < from a title", () => {
    const json = serializeJsonLd(
      postGraph(post("one", "</script><script>alert(1)</script>"), image)
    );
    assert.ok(!json.includes("<"));
    assert.ok(json.includes(String.raw`\u003c/script>`));
  });
});
