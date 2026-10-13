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

import { buildBlog, markerText } from "./blog-build.ts";

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
      now: new Date("2026-10-12T10:00:00Z"),
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
