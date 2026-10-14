import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { crawlerInstant, instantOverride, sunSpot } from "./sky-sun.ts";

const laptop = {
  card: { bottom: 640, left: 520, right: 920, top: 180 },
  height: 900,
  width: 1440,
};

describe("instantOverride", () => {
  it("reads ?at= and ignores a bad date", () => {
    assert.equal(
      instantOverride("?at=2026-10-14T13:00:00%2B02:00"),
      Date.parse("2026-10-14T13:00:00+02:00")
    );
    assert.equal(instantOverride("?at=soon"), undefined);
    assert.equal(instantOverride(""), undefined);
  });
});

describe("sunSpot", () => {
  it("puts the day sun on screen beside the card", () => {
    const spot = sunSpot(Date.parse("2026-10-14T13:00:00+02:00"), laptop);
    assert.ok(spot);
    assert.ok(spot.x > laptop.card.right && spot.x < laptop.width);
    assert.ok(spot.y > 0 && spot.y < laptop.height);
    assert.ok(spot.radius > 4 && spot.radius < 60);
  });

  it("has no sun at night or for crawlers", () => {
    assert.equal(
      sunSpot(Date.parse("2026-10-14T23:30:00+02:00"), laptop),
      undefined
    );
    assert.equal(sunSpot(crawlerInstant, laptop), undefined);
  });
});
