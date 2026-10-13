import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { goLiveAt, isScheduled, viennaMidnightIso } from "./schedule.ts";

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Vienna",
  year: "numeric",
});

const viennaDay = (now: Date): string => {
  const parts = new Map(
    dayFormat.formatToParts(now).map((part) => [part.type, part.value])
  );
  return `${parts.get("year") ?? ""}-${parts.get("month") ?? ""}-${parts.get("day") ?? ""}`;
};

describe("the Vienna day oracle", () => {
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

describe("goLiveAt", () => {
  it("is midnight Vienna time on the date, in summer and winter", () => {
    assert.equal(
      goLiveAt("2026-07-01").toISOString(),
      "2026-06-30T22:00:00.000Z"
    );
    assert.equal(
      goLiveAt("2026-12-01").toISOString(),
      "2026-11-30T23:00:00.000Z"
    );
  });

  it("follows the spring clock change on 2026-03-29", () => {
    assert.equal(
      goLiveAt("2026-03-28").toISOString(),
      "2026-03-27T23:00:00.000Z"
    );
    assert.equal(
      goLiveAt("2026-03-29").toISOString(),
      "2026-03-28T23:00:00.000Z"
    );
    assert.equal(
      goLiveAt("2026-03-30").toISOString(),
      "2026-03-29T22:00:00.000Z"
    );
  });

  it("follows the autumn clock change on 2026-10-25", () => {
    assert.equal(
      goLiveAt("2026-10-24").toISOString(),
      "2026-10-23T22:00:00.000Z"
    );
    assert.equal(
      goLiveAt("2026-10-25").toISOString(),
      "2026-10-24T22:00:00.000Z"
    );
    assert.equal(
      goLiveAt("2026-10-26").toISOString(),
      "2026-10-25T23:00:00.000Z"
    );
  });

  it("agrees with the Vienna day of the same instant", () => {
    for (const day of [
      "2026-03-29",
      "2026-10-25",
      "2027-01-01",
      "2026-06-15",
    ]) {
      const live = goLiveAt(day);
      assert.equal(viennaDay(live), day);
      const before = new Date(live.getTime() - 1);
      assert.equal(viennaDay(before) < day, true);
    }
  });

  it("rejects text that is not a day", () => {
    assert.throws(() => goLiveAt("2026-10-20T09:00"), /not a YYYY-MM-DD/);
  });
});

describe("viennaMidnightIso", () => {
  it("writes the real offset: +01:00 in winter, +02:00 in summer", () => {
    assert.equal(viennaMidnightIso("2026-01-15"), "2026-01-15T00:00:00+01:00");
    assert.equal(viennaMidnightIso("2026-07-15"), "2026-07-15T00:00:00+02:00");
  });

  it("uses the offset in force at midnight on a clock change day", () => {
    assert.equal(viennaMidnightIso("2026-03-28"), "2026-03-28T00:00:00+01:00");
    assert.equal(viennaMidnightIso("2026-03-29"), "2026-03-29T00:00:00+01:00");
    assert.equal(viennaMidnightIso("2026-03-30"), "2026-03-30T00:00:00+02:00");
    assert.equal(viennaMidnightIso("2026-10-24"), "2026-10-24T00:00:00+02:00");
    assert.equal(viennaMidnightIso("2026-10-25"), "2026-10-25T00:00:00+02:00");
    assert.equal(viennaMidnightIso("2026-10-26"), "2026-10-26T00:00:00+01:00");
  });

  it("names the same instant as goLiveAt", () => {
    for (const day of [
      "2026-03-29",
      "2026-10-25",
      "2026-12-24",
      "2026-08-01",
    ]) {
      assert.equal(
        new Date(viennaMidnightIso(day)).getTime(),
        goLiveAt(day).getTime()
      );
    }
  });
});

describe("isScheduled across a clock change", () => {
  it("goes live at 00:00 Vienna on 2026-03-29, which is 23:00Z the day before", () => {
    assert.equal(
      isScheduled("2026-03-29", new Date("2026-03-28T22:59:59Z")),
      true
    );
    assert.equal(
      isScheduled("2026-03-29", new Date("2026-03-28T23:00:00Z")),
      false
    );
  });

  it("goes live at 00:00 Vienna on 2026-03-30, which is 22:00Z the day before", () => {
    assert.equal(
      isScheduled("2026-03-30", new Date("2026-03-29T21:59:59Z")),
      true
    );
    assert.equal(
      isScheduled("2026-03-30", new Date("2026-03-29T22:00:00Z")),
      false
    );
  });

  it("goes live at 00:00 Vienna on 2026-10-25, which is 22:00Z the day before", () => {
    assert.equal(
      isScheduled("2026-10-25", new Date("2026-10-24T21:59:59Z")),
      true
    );
    assert.equal(
      isScheduled("2026-10-25", new Date("2026-10-24T22:00:00Z")),
      false
    );
  });

  it("goes live at 00:00 Vienna on 2026-10-26, which is 23:00Z the day before", () => {
    assert.equal(
      isScheduled("2026-10-26", new Date("2026-10-25T22:59:59Z")),
      true
    );
    assert.equal(
      isScheduled("2026-10-26", new Date("2026-10-25T23:00:00Z")),
      false
    );
  });
});
