import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { blogLook, imageClouds, nightPhase } from "./sky-preset.ts";

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

describe("imageClouds", () => {
  it("is the partly cloudy look of the social images", () => {
    assert.equal(imageClouds.cover, 0.6);
    assert.equal(imageClouds.fog, 0);
    assert.equal(imageClouds.overcast, 0);
    assert.ok(imageClouds.high > 0 && imageClouds.high < 1);
  });
});
