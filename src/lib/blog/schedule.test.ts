import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { goLiveAt, isScheduled } from "./schedule.ts";

describe("goLiveAt", () => {
  it("is the written instant, whatever its offset", () => {
    assert.equal(
      goLiveAt("2026-10-13T09:30:00+02:00").toISOString(),
      "2026-10-13T07:30:00.000Z"
    );
    assert.equal(
      goLiveAt("2026-12-01T09:30:00+01:00").toISOString(),
      "2026-12-01T08:30:00.000Z"
    );
    assert.equal(
      goLiveAt("2026-12-01T09:30:00-05:00").toISOString(),
      "2026-12-01T14:30:00.000Z"
    );
  });
});

describe("isScheduled", () => {
  const iso = "2026-10-13T09:30:00+02:00";

  it("is true until the exact instant", () => {
    assert.equal(isScheduled(iso, new Date("2026-10-13T07:29:59Z")), true);
  });

  it("is false from the exact instant on", () => {
    assert.equal(isScheduled(iso, new Date("2026-10-13T07:30:00Z")), false);
    assert.equal(isScheduled(iso, new Date("2026-10-14T00:00:00Z")), false);
  });

  it("keeps the instant across the spring and autumn clock changes", () => {
    const spring = "2026-03-29T03:00:00+02:00";
    assert.equal(isScheduled(spring, new Date("2026-03-29T00:59:59Z")), true);
    assert.equal(isScheduled(spring, new Date("2026-03-29T01:00:00Z")), false);
    const autumn = "2026-10-25T02:30:00+01:00";
    assert.equal(isScheduled(autumn, new Date("2026-10-25T01:29:59Z")), true);
    assert.equal(isScheduled(autumn, new Date("2026-10-25T01:30:00Z")), false);
  });
});
