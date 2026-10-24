import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { fixtureGuard } from "../src/lib/blog/build-env.ts";
import { fixtureCount, fixtureRoot } from "../src/lib/blog/fixture-posts.ts";
import { writeFixtures } from "./blog-fixtures.ts";

const repoRoot = path.join(import.meta.dirname, "..");

let root = "";

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "blog-fixtures-"));
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

describe("test posts", () => {
  it("are dated 2023 to 2025 with 2 to 4 tags", () => {
    assert.equal(writeFixtures(root, repoRoot), fixtureCount);
    const dir = path.join(root, fixtureRoot, "content/blog");
    const texts = readdirSync(dir).map((name) =>
      readFileSync(path.join(dir, name, "index.mdx"), "utf8")
    );
    assert.equal(texts.length, fixtureCount);
    for (const text of texts) {
      assert.match(text, /^date: "202[345]-/mu);
      const tags = /^tags: \[(.*)\]$/mu.exec(text)?.[1]?.split(",") ?? [];
      assert.ok(tags.length >= 2 && tags.length <= 4);
    }
    assert.ok(texts.some((text) => /^date: ".*\+01:00"$/mu.test(text)));
    assert.ok(texts.some((text) => /^date: ".*\+02:00"$/mu.test(text)));
  });

  it("carry one chart file and a diagram for the render path", () => {
    writeFixtures(root, repoRoot);
    const dir = path.join(root, fixtureRoot, "content/blog");
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
