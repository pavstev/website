import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dotDepthFade,
  dotDepthMin,
  dotFadeFrom,
  dotFadeTo,
  dotGain,
  dotSpacingFade,
} from "./blueprint-dots.ts";

describe("dotSpacingFade", () => {
  it("is zero at or under the lower spacing", () => {
    assert.equal(dotSpacingFade(dotFadeFrom), 0);
    assert.equal(dotSpacingFade(1), 0);
  });

  it("is full at or over the upper spacing", () => {
    assert.equal(dotSpacingFade(dotFadeTo), 1);
    assert.equal(dotSpacingFade(40), 1);
  });

  it("rises between the two", () => {
    const mid = dotSpacingFade((dotFadeFrom + dotFadeTo) / 2);
    assert.ok(mid > 0 && mid < 1);
  });
});

describe("dotDepthFade", () => {
  it("is full near and dimmer far, never below the floor", () => {
    assert.equal(dotDepthFade(-1), 1);
    assert.equal(dotDepthFade(1), dotDepthMin);
  });
});

describe("dotGain", () => {
  it("lifts the face alpha to the dot alpha", () => {
    assert.ok(dotGain > 1);
  });
});
