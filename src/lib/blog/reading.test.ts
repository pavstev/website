import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { VFile } from "vfile";
import { matter } from "vfile-matter";

import { readingCounts, readingOf, readingTime } from "./reading.ts";

const repo = path.join(import.meta.dirname, "../../..");

const postBody = (slug: string): string => {
  const file = new VFile(
    readFileSync(path.join(repo, "content/blog", slug, "index.mdx"), "utf8")
  );
  matter(file, { strip: true });
  return String(file.value);
};

const words = (count: number): string =>
  Array.from({ length: count }, () => "word").join(" ");

describe("readingCounts", () => {
  it("counts link text but not the URL", () => {
    assert.equal(
      readingCounts("[two words](https://example.com/a/b-c)").proseWords,
      2
    );
    assert.equal(
      readingCounts("[ref text][r]\n\n[r]: https://x.test").proseWords,
      2
    );
  });

  it("counts an image as time, not its path or alt", () => {
    const counts = readingCounts("![alt text here](photo.webp)");
    assert.deepEqual(counts, {
      codeWords: 0,
      images: 1,
      proseWords: 0,
      visuals: 0,
    });
  });

  it("counts caption and title of Figure, Chart and Diagram, not other props", () => {
    const counts = readingCounts(
      [
        '<Figure src="a-b.webp" alt="hidden alt words" caption="one two" />',
        "",
        '<Chart type="bar" src="data/x.json" title="three four" caption="five" />',
        "",
        '<Diagram name="work-loop" caption="six seven eight" />',
      ].join("\n")
    );
    assert.deepEqual(counts, {
      codeWords: 0,
      images: 1,
      proseWords: 8,
      visuals: 2,
    });
  });

  it("counts headings, inline code, Note text and footnote text", () => {
    const counts = readingCounts(
      [
        "## A heading",
        "",
        "Run `pnpm check` now.[^1]",
        "",
        "<Note>inside a note</Note>",
        "",
        "[^1]: The footnote.",
      ].join("\n")
    );
    assert.equal(counts.proseWords, 2 + 4 + 3 + 2);
  });

  it("keeps fenced code apart", () => {
    const counts = readingCounts(
      ["Two words.", "", "```ts", "const a = b(c);", "```"].join("\n")
    );
    assert.equal(counts.proseWords, 2);
    assert.equal(counts.codeWords, 4);
  });
});

describe("readingTime", () => {
  const none = { codeWords: 0, images: 0, proseWords: 0, visuals: 0 };

  it("is at least one minute", () => {
    assert.equal(readingTime(none).minutes, 1);
    assert.equal(readingOf("").minutes, 1);
  });

  it("reads 238 prose words a minute and rounds up", () => {
    assert.equal(readingOf(words(238)).minutes, 1);
    assert.equal(readingOf(words(239)).minutes, 2);
    assert.equal(readingOf(words(476)).minutes, 2);
    assert.equal(readingOf(words(477)).minutes, 3);
  });

  it("reads code at half speed, 119 words a minute", () => {
    assert.equal(readingTime({ ...none, codeWords: 119 }).seconds, 60);
    assert.equal(readingTime({ ...none, codeWords: 120 }).minutes, 2);
  });

  it("adds 12 s per image and 20 s per chart or diagram", () => {
    assert.equal(readingTime({ ...none, images: 5 }).seconds, 60);
    assert.equal(readingTime({ ...none, images: 6 }).minutes, 2);
    assert.equal(readingTime({ ...none, visuals: 3 }).seconds, 60);
    assert.equal(readingTime({ ...none, visuals: 4 }).minutes, 2);
  });

  it("sums every part before it rounds", () => {
    const reading = readingTime({
      codeWords: 119,
      images: 1,
      proseWords: 238,
      visuals: 1,
    });
    assert.equal(reading.seconds, 152);
    assert.equal(reading.minutes, 3);
    assert.equal(reading.words, 357);
  });
});

describe("the committed posts", () => {
  it("how-i-built-this-website: 2,788 prose + 11 code words, 2 figures, 4 visuals, 14 min", () => {
    const reading = readingOf(postBody("how-i-built-this-website"));
    assert.deepEqual(
      [
        reading.proseWords,
        reading.codeWords,
        reading.images,
        reading.visuals,
        reading.minutes,
        reading.words,
      ],
      [2788, 11, 2, 4, 14, 2799]
    );
  });

  it("how-i-use-ai: 2,578 prose words, no code, no images, 5 visuals = 749.9 s, 13 min", () => {
    const reading = readingOf(postBody("how-i-use-ai"));
    assert.deepEqual(
      [
        reading.proseWords,
        reading.codeWords,
        reading.images,
        reading.visuals,
        reading.minutes,
        reading.words,
      ],
      [2578, 0, 0, 5, 13, 2578]
    );
  });
});
