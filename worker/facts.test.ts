import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadBlogPosts, loadFacts, loadPostMarkdown } from "./facts.ts";
import { blogAssets, blogFeed, cv, fakeAssets } from "./fixtures.ts";

const project = {
  contributions: [{ description: "Used by 300 teams.", title: "Adoption" }],
  from: "Jan 2022",
  name: "tracelite",
  overview: "A small tracing library for Go services.",
  skills: ["Go", "OpenTelemetry"],
  to: "Present",
  websiteUrl: "https://github.com/ada/tracelite",
};

const cvAssets = (body: unknown): Fetcher =>
  fakeAssets((url) =>
    url.endsWith("/cv.json") ? Response.json(body) : new Response("# Ada")
  );

describe("loadFacts", () => {
  it("reads cv.json and llms.txt through the assets binding", async () => {
    const facts = await loadFacts(cvAssets(cv), "https://example.test");
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
    await assert.rejects(
      loadFacts(cvAssets({ basics: {} }), "https://badschema.test"),
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
    const facts = await loadFacts(cvAssets(sparse), "https://sparse.test");
    assert.equal(facts.cv.experience.items[0]?.position, "Dev");
    assert.equal(facts.cv.experience.items[0]?.skills.length, 0);
  });
  it("facts read projects from /cv.json", async () => {
    const facts = await loadFacts(
      cvAssets({ ...cv, projects: { items: [project] } }),
      "https://projects.test"
    );
    assert.deepEqual(facts.cv.projects.items, [project]);
  });
  it("accepts a project with only a name", async () => {
    const facts = await loadFacts(
      cvAssets({ ...cv, projects: { items: [{ name: "Bare" }] } }),
      "https://bareproject.test"
    );
    assert.equal(facts.cv.projects.items[0]?.name, "Bare");
    assert.equal(facts.cv.projects.items[0]?.skills.length, 0);
  });
});

describe("loadBlogPosts", () => {
  it("reads /blog/feed.json through the assets binding", async () => {
    const posts = await loadBlogPosts(blogAssets, "https://blog-a.test");
    assert.deepEqual(
      posts.map((post) => post.slug),
      ["newer", "older"]
    );
    assert.equal(posts[1]?.date, "2026-10-01");
    assert.deepEqual(posts[0]?.tags, ["One", "Two"]);
    assert.equal(posts[0]?.markdownUrl, "https://ada.example/blog/newer.md");
  });
  it("reads each origin once", async () => {
    let calls = 0;
    const assets = fakeAssets(() => {
      calls += 1;
      return Response.json(blogFeed);
    });
    await loadBlogPosts(assets, "https://blog-b.test");
    await loadBlogPosts(assets, "https://blog-b.test");
    assert.equal(calls, 1);
  });
  it("fails when the feed is missing and retries later", async () => {
    let status = 404;
    const assets = fakeAssets(() =>
      status === 200 ? Response.json(blogFeed) : new Response("", { status })
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
  it("returns the Markdown copy of a listed post", async () => {
    assert.equal(
      await loadPostMarkdown(blogAssets, "https://md-a.test", "newer"),
      "# Newer & better\n\nBody.\n"
    );
  });
});
