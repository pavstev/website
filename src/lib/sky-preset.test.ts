import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { nightPhase } from "./sky-clock.ts";
import { blogLook, earthClouds } from "./sky-preset.ts";

describe("blogLook", () => {
  it("is the clear night of every blog page", () => {
    const look = blogLook();
    assert.equal(look.clouds.cover, 0.12);
    assert.equal(look.clouds.overcast, 0);
    assert.deepEqual(look.daylight, nightPhase);
  });

  it("hands out copies", () => {
    const look = blogLook();
    look.clouds.cover = 1;
    look.daylight.day = 1;
    assert.equal(blogLook().clouds.cover, 0.12);
    assert.equal(nightPhase.day, 0);
  });
});

describe("earthClouds", () => {
  it("is a partly cloudy Earth with no fog and a clear lower sky", () => {
    assert.equal(earthClouds.cover, 0.6);
    assert.equal(earthClouds.fog, 0);
    assert.equal(earthClouds.overcast, 0);
    assert.ok(earthClouds.high > 0 && earthClouds.high < 1);
  });
});
