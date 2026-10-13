import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { nightPhase } from "./sky-clock.ts";
import { blogLook } from "./sky-preset.ts";
import { weatherPresets } from "./weather.ts";

describe("blogLook", () => {
  it("is the clear night of every blog page", () => {
    const look = blogLook();
    assert.deepEqual(look.weather, weatherPresets.clear);
    assert.deepEqual(look.daylight, nightPhase);
  });

  it("hands out copies", () => {
    const look = blogLook();
    look.weather.cover = 1;
    look.daylight.day = 1;
    assert.equal(weatherPresets.clear.cover, 0.12);
    assert.equal(nightPhase.day, 0);
  });
});
