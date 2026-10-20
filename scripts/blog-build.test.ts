import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { fixtureCount } from "../src/lib/blog/fixture-posts.ts";
import { readPostSources } from "../src/lib/blog/posts.ts";
import {
  buildBlog,
  fixtureGuard,
  markerText,
  writeFixtures,
} from "./blog-build.ts";

const repoRoot = path.join(import.meta.dirname, "..");

const fixtures = path.join(
  import.meta.dirname,
  "../src/lib/blog/fixtures/valid/content/blog"
);

let root = "";

const filesUnder = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => path.join(entry.parentPath, entry.name))
    : [];

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "blog-build-"));
  for (const slug of ["alpha", "gamma"]) {
    cpSync(path.join(fixtures, slug), path.join(root, "content/blog", slug), {
      recursive: true,
    });
  }
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

describe("markerText", () => {
  it("writes the instant it is given", () => {
    const sha = "a".repeat(40);
    const text = markerText(sha, new Date("2026-10-13T21:59:59.123Z"));
    assert.deepEqual(JSON.parse(text), {
      builtAt: "2026-10-13T21:59:59.123Z",
      sha,
    });
  });
});

describe("buildBlog", () => {
  it("picks posts at the instant it is given, not at the clock", async () => {
    const before = await buildBlog({
      drafts: false,
      now: new Date("2026-10-11T10:00:00Z"),
      root,
    });
    assert.equal(before.posts, 0);
    const after = await buildBlog({
      drafts: false,
      now: new Date("2026-10-12T16:15:00Z"),
      root,
    });
    assert.equal(after.posts, 1);
  });

  it("writes nothing for a draft in a production build", async () => {
    const { manifest, posts } = await buildBlog({ drafts: false, root });
    assert.equal(posts, 1);
    assert.deepEqual(
      Object.keys(manifest).filter((key) => key.includes("gamma")),
      []
    );
    assert.ok(Object.keys(manifest).some((key) => key.includes("alpha")));
    assert.ok(existsSync(path.join(root, "public/blog/alpha.md")));
    assert.ok(!existsSync(path.join(root, "public/blog/gamma.md")));
    assert.deepEqual(
      filesUnder(path.join(root, "public/blog-media/gamma")),
      []
    );
    assert.ok(
      filesUnder(path.join(root, "public/blog-media/alpha")).some((file) =>
        file.endsWith(".png")
      )
    );
    const written = readFileSync(path.join(root, ".blog/media.json"), "utf8");
    assert.ok(!written.includes("gamma"));
  });

  it("removes the leftovers of an earlier build that showed drafts", async () => {
    await buildBlog({ drafts: true, root });
    assert.ok(existsSync(path.join(root, "public/blog/gamma.md")));
    assert.ok(
      filesUnder(path.join(root, "public/blog-media/gamma")).length > 0
    );
    mkdirSync(path.join(root, "public/blog-media/stale"), { recursive: true });
    writeFileSync(path.join(root, "public/blog-media/stale/old.png"), "x");
    await buildBlog({ drafts: false, root });
    assert.ok(!existsSync(path.join(root, "public/blog/gamma.md")));
    assert.ok(!existsSync(path.join(root, "public/blog-media/gamma")));
    assert.ok(!existsSync(path.join(root, "public/blog-media/stale")));
    assert.ok(existsSync(path.join(root, "public/blog/alpha.md")));
  });

  it("includes the draft when drafts are shown", async () => {
    const { manifest, posts } = await buildBlog({ drafts: true, root });
    assert.equal(posts, 2);
    assert.ok(Object.keys(manifest).some((key) => key.includes("gamma")));
  });
});

describe("test posts", () => {
  const dev = { BLOG_FIXTURES: "1", NODE_ENV: "development" };

  it("load only with BLOG_FIXTURES=1 outside a production build and CI", () => {
    assert.equal(writeFixtures(root, repoRoot), fixtureCount);
    assert.equal(readPostSources(root, dev).length, fixtureCount + 2);
    assert.equal(readPostSources(root, { BLOG_FIXTURES: "1" }).length, 32);
    for (const env of [
      {},
      { BLOG_FIXTURES: "0" },
      { ...dev, NODE_ENV: "production" },
      { ...dev, CI: "true" },
      { ...dev, WORKERS_CI: "1" },
      { ...dev, BLOG_BUILT_AT: "2026-10-13T10:00:00Z" },
    ]) {
      assert.equal(readPostSources(root, env).length, 2, JSON.stringify(env));
    }
  });

  it("are valid posts dated 2023 to 2025 with 2 to 4 tags", () => {
    writeFixtures(root, repoRoot);
    const posts = readPostSources(root, dev).filter((source) =>
      source.slug.startsWith("sample-")
    );
    assert.equal(posts.length, fixtureCount);
    for (const { meta } of posts) {
      assert.match(meta.date, /^202[345]-/u);
      assert.ok(meta.tags.length >= 2 && meta.tags.length <= 4, meta.slug);
    }
    assert.ok(posts.some(({ meta }) => meta.date.endsWith("+01:00")));
    assert.ok(posts.some(({ meta }) => meta.date.endsWith("+02:00")));
  });

  it("carry one chart file and a diagram for the render path", () => {
    writeFixtures(root, repoRoot);
    const dir = path.join(root, ".blog/fixtures/content/blog");
    const slug = readdirSync(dir).find((name) =>
      existsSync(path.join(dir, name, "data/speed.json"))
    );
    assert.ok(slug);
    assert.match(
      readFileSync(path.join(dir, slug, "index.mdx"), "utf8"),
      /<Diagram name="site-pipeline"/u
    );
  });

  it("fail a production build or a CI run that asks for them", () => {
    assert.equal(fixtureGuard({ BLOG_FIXTURES: "1" }), undefined);
    assert.equal(fixtureGuard({}), undefined);
    assert.match(
      fixtureGuard({
        BLOG_BUILT_AT: "2026-10-13T10:00:00Z",
        BLOG_FIXTURES: "1",
      }) ?? "",
      /must never ship/u
    );
    assert.match(
      fixtureGuard({ BLOG_FIXTURES: "1", CI: "true" }) ?? "",
      /dev:many/u
    );
  });
});
