import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readingCounts, readingOf, readingTime } from "./reading.ts";

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
