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
  it("keeps every letter glow layer at 1.4em or less", () => {
    const shadow = /text-shadow:([^;]*);/u.exec(block(".story-body"))?.[1];
    assert.ok(shadow);
    const radii = shadow
      .matchAll(/0 0 ([\d.]+)em/gu)
      .map((match) => Number(match[1]))
      .toArray();
    assert.ok(radii.length > 0);
    for (const radius of radii) assert.ok(radius <= 1.4, `${String(radius)}em`);
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
