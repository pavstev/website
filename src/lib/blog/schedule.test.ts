import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isScheduled, viennaDay } from "./schedule.ts";

describe("viennaDay", () => {
  it("moves to the next day after 22:00 UTC in summer time", () => {
    assert.equal(viennaDay(new Date("2026-10-13T22:30:00Z")), "2026-10-14");
    assert.equal(viennaDay(new Date("2026-10-13T21:30:00Z")), "2026-10-13");
  });

  it("moves to the next day after 23:00 UTC in winter time", () => {
    assert.equal(viennaDay(new Date("2026-12-01T23:30:00Z")), "2026-12-02");
    assert.equal(viennaDay(new Date("2026-12-01T22:30:00Z")), "2026-12-01");
  });

  it("follows the clock change in spring and autumn", () => {
    assert.equal(viennaDay(new Date("2026-03-28T23:30:00Z")), "2026-03-29");
    assert.equal(viennaDay(new Date("2026-03-29T21:30:00Z")), "2026-03-29");
    assert.equal(viennaDay(new Date("2026-10-24T22:30:00Z")), "2026-10-25");
    assert.equal(viennaDay(new Date("2026-10-25T22:30:00Z")), "2026-10-25");
  });
});

describe("isScheduled", () => {
  const now = new Date("2026-10-13T10:00:00Z");

  it("is true for a date after the build day", () => {
    assert.equal(isScheduled("2026-10-14", now), true);
  });

  it("is false for today and for earlier days", () => {
    assert.equal(isScheduled("2026-10-13", now), false);
    assert.equal(isScheduled("2026-10-12", now), false);
  });

  it("counts the Vienna day, not the UTC day", () => {
    const lateUtc = new Date("2026-10-13T22:30:00Z");
    assert.equal(isScheduled("2026-10-14", lateUtc), false);
    assert.equal(isScheduled("2026-10-15", lateUtc), true);
  });
});
