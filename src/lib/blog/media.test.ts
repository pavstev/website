import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  cropKey,
  cropSpecs,
  hashName,
  imageWidths,
  mediaPath,
  mediaWidths,
  postCrops,
  postImages,
  shareImageUrl,
  shareKey,
} from "./media.ts";
import { type PostSource } from "./posts.ts";

const sourceIn = (dir: string, body: string): PostSource => ({
  body,
  dir,
  meta: {
    date: "2026-10-13",
    description: "About a post.",
    draft: false,
    readingMinutes: 1,
    sky: { phase: "night", weather: "clear" },
    slug: "a-post",
    tags: ["Test"],
    title: "A post",
    url: "https://stevanpavlovic.com/blog/a-post",
    wordCount: 3,
  },
  slug: "a-post",
});

describe("hashName", () => {
  it("puts eight hex digits of the hash and the width in the name", () => {
    const name = hashName("sky", new Uint8Array([1, 2, 3]), 768, "avif");
    assert.match(name, /^sky\.[\da-f]{8}\.768\.avif$/);
  });

  it("changes when the bytes change", () => {
    assert.notEqual(
      hashName("sky", new Uint8Array([1]), 480, "webp"),
      hashName("sky", new Uint8Array([2]), 480, "webp")
    );
  });
});

describe("imageWidths", () => {
  it("never upscales a narrow source", () => {
    assert.deepEqual(imageWidths(1000), [480, 768, 1000]);
  });

  it("caps a wide source at 1344", () => {
    assert.deepEqual(imageWidths(1600), mediaWidths);
    assert.deepEqual(mediaWidths, [480, 768, 1344]);
  });

  it("keeps one width for a tiny source", () => {
    assert.deepEqual(imageWidths(300), [300]);
  });
});

describe("shareKey", () => {
  it("names the share entry of a post", () => {
    assert.equal(shareKey("a-post"), "a-post/share");
  });
});

describe("postImages", () => {
  it("lists Figure, img and Markdown images once each", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "blog-media-"));
    writeFileSync(path.join(dir, "one.webp"), "");
    writeFileSync(path.join(dir, "two.webp"), "");
    const body = [
      '<Figure src="one.webp" alt="One" caption="A still" />',
      "",
      "![Two](./two.webp)",
      "",
      '<img src="one.webp" alt="Again" />',
      "",
      "![Remote](https://example.com/x.png)",
    ].join("\n");
    assert.deepEqual(postImages(sourceIn(dir, body)), ["one.webp", "two.webp"]);
  });

  it("fails with the post and the file when an image is missing", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "blog-media-"));
    assert.throws(
      () => postImages(sourceIn(dir, '<Figure src="gone.webp" alt="Gone" />')),
      /content\/blog\/a-post\/index\.mdx: image "gone\.webp" not found/
    );
  });
});

describe("mediaPath", () => {
  it("keeps the plain path when the build has not run", () => {
    assert.equal(
      mediaPath("no-such-post", "./still.webp"),
      "/blog-media/no-such-post/still.webp"
    );
  });

  it("leaves absolute and external URLs alone", () => {
    assert.equal(mediaPath("a", "/og-image.jpg"), "/og-image.jpg");
    assert.equal(
      mediaPath("a", "https://example.com/x.png"),
      "https://example.com/x.png"
    );
  });
});

describe("shareImageUrl", () => {
  const entry = {
    avif: [],
    blur: "",
    fallback: "/blog-media/a-post/share.0123abcd.png",
    height: 630,
    webp: [],
    width: 1200,
    widths: [1200],
  };

  it("gives the absolute share image URL of a post", () => {
    assert.equal(
      shareImageUrl("a-post", "https://stevanpavlovic.com", {
        "a-post/share": entry,
      }),
      "https://stevanpavlovic.com/blog-media/a-post/share.0123abcd.png"
    );
  });

  it("gives nothing when the post has no share image", () => {
    assert.equal(
      shareImageUrl("other", "https://stevanpavlovic.com", {
        "a-post/share": entry,
      }),
      undefined
    );
  });
});

const cropEntry = (name: string, width: number, height: number) => ({
  avif: [],
  blur: "",
  fallback: `/blog-media/a-post/crop-${name}.0123abcd.${String(width)}.webp`,
  height,
  webp: [],
  width,
  widths: [width],
});

describe("postCrops", () => {
  it("asks for 16x9 at 1920, 4x3 at 1600 and 1x1 at 1200", () => {
    assert.deepEqual(
      cropSpecs.map((spec) => [spec.name, spec.width, spec.height]),
      [
        ["16x9", 1920, 1080],
        ["4x3", 1600, 1200],
        ["1x1", 1200, 1200],
      ]
    );
  });

  it("gives the absolute crop URLs in that order", () => {
    const media = Object.fromEntries(
      cropSpecs.map((spec) => [
        cropKey("a-post", spec.name),
        cropEntry(spec.name, spec.width, spec.height),
      ])
    );
    assert.deepEqual(
      postCrops("a-post", "https://stevanpavlovic.com", media).map((crop) => [
        crop.url,
        crop.width,
        crop.height,
      ]),
      [
        [
          "https://stevanpavlovic.com/blog-media/a-post/crop-16x9.0123abcd.1920.webp",
          1920,
          1080,
        ],
        [
          "https://stevanpavlovic.com/blog-media/a-post/crop-4x3.0123abcd.1600.webp",
          1600,
          1200,
        ],
        [
          "https://stevanpavlovic.com/blog-media/a-post/crop-1x1.0123abcd.1200.webp",
          1200,
          1200,
        ],
      ]
    );
  });

  it("gives nothing for a post without crops", () => {
    assert.deepEqual(postCrops("other", "https://stevanpavlovic.com", {}), []);
  });
});
