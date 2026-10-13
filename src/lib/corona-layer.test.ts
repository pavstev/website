import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { placeLayer } from "./corona-layer.ts";

const sky = { bottom: 844, left: 0, right: 390, top: 0 };
const stage = { bottom: 1600, left: 0, right: 390, top: 0 };
const face = { bottom: 174, left: 128, right: 262, top: 40 };

describe("placeLayer", () => {
  it("snaps the layer to the sky pixel grid and clips it to the stage", () => {
    const place = placeLayer({
      face,
      pitchX: 0.75,
      pitchY: 0.75,
      previous: undefined,
      reach: 7.6,
      sky,
      stage,
    });
    assert.ok(place);
    assert.equal(place.left, 0);
    assert.equal(place.width % 32, 0);
    assert.equal(place.height % 32, 0);
    assert.ok(Number.isSafeInteger(place.originX));
    assert.ok(Number.isSafeInteger(place.originY));
    assert.ok(place.cssWidth >= 390);
    assert.ok(
      Math.abs((844 - (place.top + place.cssHeight)) * 0.75 - place.originY) <
        1e-9
    );
  });

  it("keeps its page position while the page scrolls", () => {
    const input = {
      face,
      pitchX: 0.75,
      pitchY: 0.75,
      previous: undefined,
      reach: 7.6,
      sky,
      stage,
    };
    const first = placeLayer(input);
    const shift = 10;
    const moved = placeLayer({
      ...input,
      face: { ...face, bottom: face.bottom - shift, top: face.top - shift },
      previous: first,
      stage: { ...stage, bottom: stage.bottom - shift, top: -shift },
    });
    assert.ok(first && moved);
    assert.equal(moved.top, first.top);
    assert.ok(Math.abs(moved.originY - first.originY - shift * 0.75) < 1e-9);
  });

  it("keeps its page position when a fractional scroll adds float noise", () => {
    const input = {
      face,
      pitchX: 0.75,
      pitchY: 0.75,
      previous: undefined,
      reach: 7.6,
      sky,
      stage,
    };
    const first = placeLayer(input);
    const shift = 10.333333;
    const noise = 0.00001;
    const moved = placeLayer({
      ...input,
      face: {
        ...face,
        bottom: face.bottom - shift + noise,
        top: face.top - shift + noise,
      },
      previous: first,
      stage: { ...stage, bottom: stage.bottom - shift, top: -shift },
    });
    assert.ok(first && moved);
    assert.equal(moved.top, first.top);
    assert.equal(moved.key, first.key);
  });

  it("skips a portrait with no size", () => {
    assert.equal(
      placeLayer({
        face: { ...face, right: face.left },
        pitchX: 0.75,
        pitchY: 0.75,
        previous: undefined,
        reach: 7.6,
        sky,
        stage,
      }),
      undefined
    );
  });
});
