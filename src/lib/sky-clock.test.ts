import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isTimeZone, wallMinutes, zoneFor } from "./sky-clock.ts";

const at = Date.UTC(2026, 9, 20, 20, 41);
const visitor = (
  lat: number,
  lon: number
): {
  kind: string;
  lat: number;
  lon: number;
} => ({ kind: "visitor", lat, lon });

describe("zoneFor", () => {
  it("keeps the Belgrade zone for Stevan's sky", () => {
    assert.equal(
      zoneFor(
        { kind: "belgrade", lat: 48.2, lon: 16.4 },
        "Asia/Tokyo",
        "UTC",
        at
      ),
      "Europe/Belgrade"
    );
  });

  it("uses the zone the weather answer reported", () => {
    assert.equal(
      zoneFor(visitor(36.9, 80.8), "Asia/Urumqi", "Europe/Belgrade", at),
      "Asia/Urumqi"
    );
  });

  it("keeps the browser zone for a place near the visitor", () => {
    assert.equal(
      zoneFor(visitor(52.5, 13.4), undefined, "Europe/Belgrade", at),
      "Europe/Belgrade"
    );
  });

  it("falls back to the longitude hour for a far place", () => {
    assert.equal(
      zoneFor(visitor(36.9, 80.8), undefined, "Europe/Belgrade", at),
      "Etc/GMT-5"
    );
    assert.equal(
      zoneFor(visitor(40.7, -74), undefined, "Europe/Belgrade", at),
      "Etc/GMT+5"
    );
    assert.equal(
      zoneFor(visitor(51.5, -0.1), undefined, "Asia/Tokyo", at),
      "Etc/GMT"
    );
  });

  it("gives a far place its own wall clock", () => {
    const zone = zoneFor(visitor(36.9, 80.8), undefined, "Europe/Belgrade", at);
    assert.equal(wallMinutes(at, zone), 1 * 60 + 41);
  });
});

describe("isTimeZone", () => {
  it("accepts real zones and rejects others", () => {
    assert.equal(isTimeZone("Asia/Urumqi"), true);
    assert.equal(isTimeZone("Etc/GMT-5"), true);
    assert.equal(isTimeZone("Not/AZone"), false);
  });
});
