import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sceneCounts } from "../../data/dotfiles-story.ts";
import { buildScene, type Scene } from "./blueprint-geometry.ts";
import { posterSvg, sceneSvg } from "./blueprint-svg.ts";
import { sampleFacts } from "./sample-facts.ts";
import { type StepId } from "./step-ids.ts";

const counts = sceneCounts(sampleFacts);

const build = (step: StepId, t: number): Scene =>
  buildScene(step, t, 1, counts);

const svg = posterSvg(1200, 630, counts);

describe("posterSvg", () => {
  it("is an svg with five slab paths", () => {
    assert.ok(svg.startsWith("<svg"));
    assert.ok(svg.endsWith("</svg>"));
    assert.equal(svg.match(/<path class="slab"/g)?.length, 5);
  });

  it("writes the labels in Geist Mono at 11 px", () => {
    assert.ok(svg.includes('font-family="Geist Mono'));
    assert.ok(svg.includes('font-size="11"'));
    for (const name of ["docs/", "scripts/", "claude/", "home/", "rust/"]) {
      assert.ok(svg.includes(`>${name}</text>`), name);
    }
  });

  it("colors by tone class and currentColor, never by a literal", () => {
    assert.ok(svg.includes('stroke="currentColor"'));
    assert.ok(svg.includes('class="tone-accent"'));
    assert.ok(!/#[0-9a-f]{3,8}\b/i.test(svg));
    assert.ok(!/rgba?\(|hsla?\(/i.test(svg));
  });

  it("has no broken numbers", () => {
    assert.ok(!svg.includes("NaN"));
    assert.ok(!svg.includes("undefined"));
    assert.ok(!svg.includes("Infinity"));
  });

  it("draws any step, with its tone classes", () => {
    const fan = sceneSvg(build("c06", 1), 800, 450);
    assert.ok(fan.includes('class="tone-mark"'));
    assert.ok(!fan.includes("NaN"));
    const denied = sceneSvg(build("h1", 0.7), 800, 450);
    assert.ok(denied.includes('class="tone-denied"'));
  });

  it("follows the size it is given", () => {
    assert.ok(svg.includes('viewBox="0 0 1200 630"'));
    assert.ok(posterSvg(800, 800, counts).includes('viewBox="0 0 800 800"'));
  });
});
