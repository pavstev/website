import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { aboutSlug, readAbout } from "./about.ts";

const roots: string[] = [];

const rootWith = (text: string): string => {
  const root = mkdtempSync(path.join(tmpdir(), "about-"));
  roots.push(root);
  mkdirSync(path.join(root, "content/about"), { recursive: true });
  writeFileSync(path.join(root, "content/about/index.mdx"), text);
  return root;
};

after(() => {
  for (const root of roots) rmSync(root, { force: true, recursive: true });
});

describe("readAbout", () => {
  it("reads the title, the description and the body", () => {
    const about = readAbout(
      rootWith(
        "---\ntitle: About me\ndescription: Who I am.\n---\n\n## One\n\nText.\n"
      )
    );
    assert.equal(about.title, "About me");
    assert.equal(about.description, "Who I am.");
    assert.equal(about.slug, aboutSlug);
    assert.match(about.body, /^\s*## One/u);
    assert.doesNotMatch(about.body, /title:/u);
  });

  it("rejects a key the page does not use", () => {
    assert.throws(
      () =>
        readAbout(
          rootWith(
            "---\ntitle: A\ndescription: B\ndate: 2026-10-15\n---\nText\n"
          )
        ),
      /content\/about\/index\.mdx/u
    );
  });

  it("rejects a missing title and a description over 160 characters", () => {
    assert.throws(
      () => readAbout(rootWith("---\ndescription: B\n---\nText\n")),
      /title/u
    );
    assert.throws(
      () =>
        readAbout(
          rootWith(
            `---\ntitle: A\ndescription: ${"x".repeat(161)}\n---\nText\n`
          )
        ),
      /description/u
    );
  });

  it("reads the committed page", () => {
    const about = readAbout();
    assert.ok(about.title.length > 0);
    assert.ok(about.description.length <= 160);
    assert.doesNotMatch(about.body, /[\u{2013}\u{2014}]/u);
  });
});
