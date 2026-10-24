import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const storyCss = readFileSync(
  path.join(import.meta.dirname, "..", "..", "styles", "story.css"),
  "utf8"
);

const block = (selector: string): string => {
  const start = storyCss.indexOf(`\n${selector} {`);
  assert.notEqual(start, -1, `no rule for ${selector}`);
  return storyCss.slice(start, storyCss.indexOf("\n}", start));
};

describe("story.css scroll speed rules", () => {
  it("puts no glow or blur behind the story text", () => {
    assert.doesNotMatch(block(".story-body"), /text-shadow|backdrop-filter/u);
    assert.doesNotMatch(storyCss, /\.story-body::before/u);
  });

  it("removes the floor wave while the page scrolls", () => {
    assert.match(
      block(":root[data-scrolling] [data-story]::after"),
      /animation: none;/u
    );
  });

  it("contains the layout of the skills step", () => {
    assert.match(block('.story-step[data-step="skills"]'), /contain: layout;/u);
  });
});
