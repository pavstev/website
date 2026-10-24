import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { plateSpot } from "./story-plates.ts";

const area = { height: 900, top: 48, width: 1440 };
const size = { height: 120, width: 400 };

describe("plateSpot", () => {
  it("keeps a desktop plate right of the step text", () => {
    const text = { height: 300, left: 32, top: 560, width: 500 };
    const spot = plateSpot([700, 400], size, text, area, true);
    assert.ok(spot.left >= 32 + 500 + 24);
    assert.ok(spot.left + spot.width <= 1440 - 12);
  });

  it("sits under the bar and draws a wire down to the anchor", () => {
    const spot = plateSpot([700, 400], size, undefined, area, true);
    assert.equal(spot.top, 60);
    assert.ok(spot.wire);
    const [x0, y0, x1, y1] = spot.wire;
    assert.equal(y0, 180);
    assert.deepEqual([x1, y1], [700, 400]);
    assert.ok(x0 >= spot.left && x0 <= spot.left + spot.width);
  });

  it("drops the wire when the anchor is under the plate", () => {
    const spot = plateSpot([700, 150], size, undefined, area, true);
    assert.equal(spot.wire, undefined);
  });

  it("uses the full phone width and ignores the text column", () => {
    const phone = { height: 844, top: 48, width: 390 };
    const text = { height: 300, left: 20, top: 500, width: 350 };
    const spot = plateSpot(
      [120, 300],
      { height: 90, width: 366 },
      text,
      phone,
      false
    );
    assert.equal(spot.left, 12);
    assert.equal(spot.width, 366);
  });

  it("never leaves a 320 wide stage", () => {
    const phone = { height: 568, top: 48, width: 320 };
    const spot = plateSpot(
      [300, 260],
      { height: 90, width: 296 },
      undefined,
      phone,
      false
    );
    assert.ok(spot.left >= 12);
    assert.ok(spot.left + spot.width <= 320 - 12);
  });
});
