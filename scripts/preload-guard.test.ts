import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { findPreloads, imagePreloads, postPages } from "./preload-guard.ts";

describe("imagePreloads", () => {
  it("finds a preload with rel before as", () => {
    const html = '<head><link rel="preload" as="image" href="/a.webp"/></head>';
    assert.equal(imagePreloads(html).length, 1);
  });

  it("finds a preload with as before rel", () => {
    const html = '<link as="image" href="/a.webp" rel="preload">';
    assert.equal(imagePreloads(html).length, 1);
  });

  it("accepts single quotes, bare values and extra attributes", () => {
    const html = [
      "<link rel='preload' as='image' href='/a.webp'>",
      "<link href=/b.webp rel=preload as=image>",
      '<link rel="preload" href="/c.avif" as="image" imageSrcSet="/c.avif 1x" fetchPriority="high" />',
    ].join("");
    assert.equal(imagePreloads(html).length, 3);
  });

  it("matches names and values in any case", () => {
    assert.equal(
      imagePreloads('<LINK REL="Preload" AS="Image" HREF="/a.webp">').length,
      1
    );
  });

  it("ignores preloads of other kinds", () => {
    const html = [
      '<link rel="preload" as="font" href="/f.woff2" crossorigin="">',
      '<link rel="preload" as="script" href="/s.js">',
      '<link rel="preload" href="/x">',
    ].join("");
    assert.deepEqual(imagePreloads(html), []);
  });

  it("ignores image links that are not preloads", () => {
    const html = [
      '<link rel="icon" href="/favicon.ico" as="image">',
      '<link rel="stylesheet" href="/a.css">',
      '<link rel="prefetch" as="image" href="/a.webp">',
    ].join("");
    assert.deepEqual(imagePreloads(html), []);
  });

  it("ignores text that only mentions a preload", () => {
    const html =
      '<p>&lt;link rel="preload" as="image"&gt;</p><meta name="x" content="rel=preload as=image">';
    assert.deepEqual(imagePreloads(html), []);
  });

  it("finds a preload among several link tags", () => {
    const html =
      '<link rel="stylesheet" href="/a.css"><link rel="preload" as="image" href="/a.webp"><link rel="icon" href="/i.ico">';
    assert.deepEqual(imagePreloads(html), [
      '<link rel="preload" as="image" href="/a.webp">',
    ]);
  });
});

describe("findPreloads", () => {
  const root = mkdtempSync(path.join(tmpdir(), "preload-guard-"));
  const dir = path.join(root, "blog");
  mkdirSync(dir);
  writeFileSync(path.join(dir, "clean.html"), "<head></head>");
  writeFileSync(
    path.join(dir, "dirty.html"),
    '<link rel="preload" as="image" href="/a.webp">'
  );
  writeFileSync(path.join(dir, "feed.xml"), '<link rel="preload" as="image">');
  after(() => {
    rmSync(root, { force: true, recursive: true });
  });

  it("lists only the HTML pages in the folder", () => {
    assert.deepEqual(
      postPages(dir).map((file) => path.basename(file)),
      ["clean.html", "dirty.html"]
    );
  });

  it("returns the pages that hold an image preload", () => {
    assert.deepEqual(
      findPreloads(dir).map((page) => path.basename(page.file)),
      ["dirty.html"]
    );
  });

  it("returns nothing when the folder does not exist", () => {
    assert.deepEqual(postPages(path.join(root, "missing")), []);
  });
});
