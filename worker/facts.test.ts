import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { servedCv } from "../src/lib/cv-sample.ts";
import { loadBlogPosts, loadFacts, loadPostMarkdown } from "./facts.ts";

const cv = {
  basics: {
    headline: "Engineer",
    location: "Vienna, Austria",
    name: "Ada Example",
  },
  experience: {
    items: [
      {
        company: "Example",
        contributions: [{ description: "Built it.", title: "Ledger" }],
        from: "Jan 2020",
        overview: "Ran the platform.",
        position: "Lead",
        skills: ["Kafka"],
        to: "Present",
      },
    ],
  },
  summary: "Builds systems.",
  updatedAt: "2026-10-08T00:00:00.000Z",
};

const project = {
  contributions: [{ description: "Used by 300 teams.", title: "Adoption" }],
  from: "Jan 2022",
  name: "tracelite",
  overview: "A small tracing library for Go services.",
  skills: ["Go", "OpenTelemetry"],
  to: "Present",
  websiteUrl: "https://github.com/ada/tracelite",
};

const fakeAssets = (answer: (url: string) => Response): Fetcher =>
  ({
    fetch: (url: string) => Promise.resolve(answer(url)),
  }) as unknown as Fetcher;

describe("loadFacts", () => {
  it("reads cv.json and llms.txt through the assets binding", async () => {
    const assets = fakeAssets((url) =>
      url.endsWith("/cv.json") ? Response.json(cv) : new Response("# Ada")
    );
    const facts = await loadFacts(assets, "https://example.test");
    assert.equal(facts.cv.basics.name, "Ada Example");
    assert.equal(facts.llms, "# Ada");
  });
  it("fails when an asset is missing", async () => {
    const assets = fakeAssets(() => new Response("", { status: 404 }));
    await assert.rejects(
      loadFacts(assets, "https://missing.test"),
      /facts unavailable/
    );
  });
  it("retries after a failed load and ignores unknown fields", async () => {
    let calls = 0;
    const assets = fakeAssets((url) => {
      calls += 1;
      if (calls <= 2) {
        return new Response("", { status: 503 });
      }
      return url.endsWith("/cv.json")
        ? Response.json({ ...cv, extra: { anything: true } })
        : new Response("# Ada");
    });
    await assert.rejects(
      loadFacts(assets, "https://flaky.test"),
      /facts unavailable/
    );
    const facts = await loadFacts(assets, "https://flaky.test");
    assert.equal(facts.cv.basics.name, "Ada Example");
    assert.equal("extra" in facts.cv, false);
  });
  it("throws facts unavailable with a cause on malformed JSON", async () => {
    const assets = fakeAssets(
      (url) => new Response(url.endsWith("/cv.json") ? "{nope" : "# Ada")
    );
    await assert.rejects(loadFacts(assets, "https://badjson.test"), (error) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "facts unavailable");
      assert.ok(error.cause instanceof Error);
      return true;
    });
  });
  it("throws facts unavailable with a cause on a schema failure", async () => {
    const assets = fakeAssets((url) =>
      url.endsWith("/cv.json")
        ? Response.json({ basics: {} })
        : new Response("# Ada")
    );
    await assert.rejects(
      loadFacts(assets, "https://badschema.test"),
      (error) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "facts unavailable");
        assert.ok(error.cause);
        return true;
      }
    );
  });
  it("accepts a role without overview, skills or contributions", async () => {
    const sparse = {
      ...cv,
      experience: {
        items: [{ company: "Bare", from: "2019", position: "Dev", to: "2020" }],
      },
    };
    const assets = fakeAssets((url) =>
      url.endsWith("/cv.json") ? Response.json(sparse) : new Response("# Ada")
    );
    const facts = await loadFacts(assets, "https://sparse.test");
    assert.equal(facts.cv.experience.items[0]?.position, "Dev");
    assert.equal(facts.cv.experience.items[0]?.skills.length, 0);
  });
  it("reads the cv.json the site serves, projects included", async () => {
    const assets = fakeAssets((url) =>
      url.endsWith("/cv.json") ? Response.json(servedCv) : new Response("# Ada")
    );
    const facts = await loadFacts(assets, "https://served.test");
    assert.equal(facts.cv.basics.name, "Ada Example");
    assert.equal(facts.cv.basics.location, "");
    assert.equal(facts.cv.projects?.items[0]?.name, "Ledger");
    assert.equal(facts.cv.experience.items[0]?.position, "Lead");
    assert.equal(facts.cv.experience.items[0]?.to, "Now");
  });
  it("facts read projects from /cv.json", async () => {
    const assets = fakeAssets((url) =>
      url.endsWith("/cv.json")
        ? Response.json({ ...cv, projects: { items: [project] } })
        : new Response("# Ada")
    );
    const facts = await loadFacts(assets, "https://projects.test");
    assert.deepEqual(facts.cv.projects?.items, [project]);
  });
  it("accepts a project with only a name", async () => {
    const assets = fakeAssets((url) =>
      url.endsWith("/cv.json")
        ? Response.json({ ...cv, projects: { items: [{ name: "Bare" }] } })
        : new Response("# Ada")
    );
    const facts = await loadFacts(assets, "https://bareproject.test");
    assert.equal(facts.cv.projects?.items[0]?.name, "Bare");
    assert.equal(facts.cv.projects?.items[0]?.skills.length, 0);
  });
});

const feed = {
  items: [
    {
      _markdown_url: "https://example.test/blog/second.md",
      date_published: "2026-10-12T00:00:00Z",
      id: "https://example.test/blog/second",
      summary: "The second post.",
      tags: ["Two"],
      title: "Second",
      url: "https://example.test/blog/second",
    },
    {
      _markdown_url: "https://example.test/blog/first.md",
      date_published: "2026-10-01T00:00:00Z",
      id: "https://example.test/blog/first",
      summary: "The first post.",
      tags: ["One", "Uno"],
      title: "First",
      url: "https://example.test/blog/first",
    },
  ],
};

describe("loadBlogPosts", () => {
  it("reads /blog/feed.json through the assets binding", async () => {
    const assets = fakeAssets((url) =>
      url.endsWith("/blog/feed.json")
        ? Response.json(feed)
        : new Response("", { status: 404 })
    );
    const posts = await loadBlogPosts(assets, "https://blog-a.test");
    assert.deepEqual(
      posts.map((post) => post.slug),
      ["second", "first"]
    );
    assert.equal(posts[1]?.date, "2026-10-01");
    assert.deepEqual(posts[1]?.tags, ["One", "Uno"]);
    assert.equal(posts[0]?.markdownUrl, "https://example.test/blog/second.md");
  });
  it("reads each origin once", async () => {
    let calls = 0;
    const assets = fakeAssets(() => {
      calls += 1;
      return Response.json(feed);
    });
    await loadBlogPosts(assets, "https://blog-b.test");
    await loadBlogPosts(assets, "https://blog-b.test");
    assert.equal(calls, 1);
  });
  it("fails when the feed is missing and retries later", async () => {
    let status = 404;
    const assets = fakeAssets(() =>
      status === 200 ? Response.json(feed) : new Response("", { status })
    );
    await assert.rejects(
      loadBlogPosts(assets, "https://blog-c.test"),
      /blog unavailable/
    );
    status = 200;
    const posts = await loadBlogPosts(assets, "https://blog-c.test");
    assert.equal(posts.length, 2);
  });
  it("fails on a malformed feed", async () => {
    const assets = fakeAssets(() => Response.json({ items: [{ title: 1 }] }));
    await assert.rejects(
      loadBlogPosts(assets, "https://blog-d.test"),
      /blog unavailable/
    );
  });
});

describe("loadPostMarkdown", () => {
  const assets = fakeAssets((url) => {
    if (url.endsWith("/blog/feed.json")) {
      return Response.json(feed);
    }
    return url.endsWith("/blog/first.md")
      ? new Response("# First\n")
      : new Response("", { status: 404 });
  });
  it("returns the Markdown copy of a listed post", async () => {
    assert.equal(
      await loadPostMarkdown(assets, "https://md-a.test", "first"),
      "# First\n"
    );
  });
  it("returns undefined for a slug that is not in the feed", async () => {
    assert.equal(
      await loadPostMarkdown(assets, "https://md-b.test", "draft-post"),
      undefined
    );
  });
  it("returns undefined when the copy is missing", async () => {
    assert.equal(
      await loadPostMarkdown(assets, "https://md-c.test", "second"),
      undefined
    );
  });
});
