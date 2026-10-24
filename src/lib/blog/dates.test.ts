import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dateLabel,
  fullDateTime,
  relativeBucket,
  relativeLabel,
  shortDate,
  viennaClock,
  viennaDate,
  zoneName,
} from "./dates.ts";

const vienna = "Europe/Vienna";
const summer = "2026-10-13T09:30:00+02:00";
const winter = "2026-12-01T09:30:00+01:00";
const at = (iso: string): Date => new Date(iso);

describe("viennaDate", () => {
  it("prints the Vienna day for both offsets", () => {
    assert.equal(viennaDate(summer), "13 Oct 2026");
    assert.equal(viennaDate(winter), "1 Dec 2026");
    assert.equal(viennaDate("2026-09-13T09:30:00+02:00"), "13 Sep 2026");
  });

  it("moves to the Vienna day of an instant written in another offset", () => {
    assert.equal(viennaDate("2026-10-13T23:30:00+00:00"), "14 Oct 2026");
    assert.equal(viennaDate("2026-12-01T23:30:00+00:00"), "2 Dec 2026");
  });
});

describe("shortDate", () => {
  it("prints the day in the reader's zone", () => {
    assert.equal(
      shortDate("2026-10-13T01:30:00+02:00", "America/New_York"),
      "12 Oct 2026"
    );
    assert.equal(shortDate(summer, "Asia/Tokyo"), "13 Oct 2026");
  });
});

describe("relativeBucket", () => {
  it("says just now within a minute, both ways", () => {
    assert.deepEqual(
      relativeBucket(summer, at("2026-10-13T07:30:59Z"), vienna),
      {
        unit: "now",
        value: 0,
      }
    );
    assert.deepEqual(
      relativeBucket(summer, at("2026-10-13T07:29:01Z"), vienna),
      {
        unit: "now",
        value: 0,
      }
    );
  });

  it("counts minutes, then hours", () => {
    assert.deepEqual(
      relativeBucket(summer, at("2026-10-13T07:42:00Z"), vienna),
      {
        unit: "minute",
        value: -12,
      }
    );
    assert.deepEqual(
      relativeBucket(summer, at("2026-10-13T10:31:00Z"), vienna),
      {
        unit: "hour",
        value: -3,
      }
    );
  });

  it("counts calendar days in the reader's zone after a day", () => {
    assert.deepEqual(
      relativeBucket(summer, at("2026-10-14T08:00:00Z"), vienna),
      {
        unit: "day",
        value: -1,
      }
    );
    assert.deepEqual(
      relativeBucket(summer, at("2026-10-15T21:59:00Z"), vienna),
      {
        unit: "day",
        value: -2,
      }
    );
    assert.deepEqual(
      relativeBucket(summer, at("2026-10-15T22:01:00Z"), vienna),
      {
        unit: "day",
        value: -3,
      }
    );
  });

  it("keeps calendar days right across the autumn clock change", () => {
    const sat = "2026-10-24T12:00:00+02:00";
    assert.deepEqual(relativeBucket(sat, at("2026-10-26T11:00:00Z"), vienna), {
      unit: "day",
      value: -2,
    });
    assert.deepEqual(relativeBucket(sat, at("2026-10-25T22:59:00Z"), vienna), {
      unit: "day",
      value: -1,
    });
  });

  it("keeps calendar days right across the spring clock change", () => {
    const sat = "2026-03-28T12:00:00+01:00";
    assert.deepEqual(relativeBucket(sat, at("2026-03-29T21:59:00Z"), vienna), {
      unit: "day",
      value: -1,
    });
    assert.deepEqual(relativeBucket(sat, at("2026-03-29T22:01:00Z"), vienna), {
      unit: "day",
      value: -2,
    });
  });

  it("stops at seven days", () => {
    assert.notEqual(
      relativeBucket(summer, at("2026-10-20T07:29:59Z"), vienna),
      undefined
    );
    assert.equal(
      relativeBucket(summer, at("2026-10-20T07:30:00Z"), vienna),
      undefined
    );
  });

  it("counts forward for a scheduled draft", () => {
    assert.deepEqual(
      relativeBucket(summer, at("2026-10-13T04:30:00Z"), vienna),
      {
        unit: "hour",
        value: 3,
      }
    );
    assert.deepEqual(
      relativeBucket(summer, at("2026-10-11T10:00:00Z"), vienna),
      {
        unit: "day",
        value: 2,
      }
    );
  });
});

describe("relativeLabel and dateLabel", () => {
  it("writes English relative text", () => {
    assert.equal(
      relativeLabel(summer, at("2026-10-13T07:30:10Z"), vienna),
      "just now"
    );
    assert.equal(
      relativeLabel(summer, at("2026-10-13T10:31:00Z"), vienna),
      "3 hours ago"
    );
    assert.equal(
      relativeLabel(summer, at("2026-10-14T08:00:00Z"), vienna),
      "yesterday"
    );
    assert.equal(
      relativeLabel(summer, at("2026-10-18T08:00:00Z"), vienna),
      "5 days ago"
    );
    assert.equal(
      relativeLabel(summer, at("2026-10-12T06:00:00Z"), vienna),
      "tomorrow"
    );
    assert.equal(
      relativeLabel(summer, at("2026-10-13T05:30:00Z"), vienna),
      "in 2 hours"
    );
  });

  it("falls back to the reader's date after seven days", () => {
    assert.equal(
      dateLabel(summer, at("2026-11-01T08:00:00Z"), vienna),
      "13 Oct 2026"
    );
    assert.equal(
      dateLabel(
        "2026-10-13T01:30:00+02:00",
        at("2026-11-01T08:00:00Z"),
        "America/New_York"
      ),
      "12 Oct 2026"
    );
  });
});

describe("the tip lines", () => {
  it("writes weekday, date, time and zone in the reader's zone", () => {
    assert.equal(
      fullDateTime(summer, vienna),
      "Tuesday, 13 October 2026, 09:30 CEST"
    );
    assert.equal(
      fullDateTime(winter, vienna),
      "Tuesday, 1 December 2026, 09:30 CET"
    );
    assert.equal(
      fullDateTime(summer, "America/New_York"),
      "Tuesday, 13 October 2026, 03:30 EDT"
    );
    assert.equal(
      fullDateTime(summer, "Asia/Tokyo"),
      "Tuesday, 13 October 2026, 16:30 GMT+9"
    );
  });

  it("names the zone in English, or as GMT plus offset", () => {
    assert.equal(zoneName(at("2026-07-01T00:00:00Z"), "Europe/London"), "BST");
    assert.equal(zoneName(at("2026-07-01T00:00:00Z"), "UTC"), "UTC");
  });

  it("gives the Vienna clock time", () => {
    assert.equal(viennaClock(summer), "09:30");
    assert.equal(viennaClock("2026-10-13T09:30:00-05:00"), "16:30");
  });
});
