import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { weatherPresets, weatherStates } from "../weather.ts";
import { frontmatterSchema } from "./schema.ts";

const sample = {
  date: "2026-10-13",
  description: "A short post about the sky.",
  sky: { phase: "night", weather: "clear" },
  tags: ["WebGL"],
  title: "A post",
};

describe("frontmatterSchema", () => {
  it("parses a valid sample and defaults draft to false", () => {
    const parsed = frontmatterSchema.parse(sample);
    assert.equal(parsed.draft, false);
    assert.equal(parsed.updated, undefined);
    assert.deepEqual(parsed.sky, { phase: "night", weather: "clear" });
  });

  it("accepts a description of 160 characters", () => {
    assert.ok(
      frontmatterSchema.safeParse({ ...sample, description: "a".repeat(160) })
        .success
    );
  });

  it("rejects a description of 161 characters", () => {
    const result = frontmatterSchema.safeParse({
      ...sample,
      description: "a".repeat(161),
    });
    assert.equal(result.success, false);
    assert.deepEqual(result.error?.issues[0]?.path, ["description"]);
  });

  it("rejects an unknown weather", () => {
    const result = frontmatterSchema.safeParse({
      ...sample,
      sky: { phase: "night", weather: "hail" },
    });
    assert.equal(result.success, false);
    assert.deepEqual(result.error?.issues[0]?.path, ["sky", "weather"]);
  });

  it("rejects an empty tag list and more than five tags", () => {
    assert.equal(
      frontmatterSchema.safeParse({ ...sample, tags: [] }).success,
      false
    );
    assert.equal(
      frontmatterSchema.safeParse({
        ...sample,
        tags: ["a", "b", "c", "d", "e", "f"],
      }).success,
      false
    );
  });

  it("rejects a date that is not an ISO date", () => {
    assert.equal(
      frontmatterSchema.safeParse({ ...sample, date: "13.10.2026" }).success,
      false
    );
  });

  it("rejects a day that is not on the calendar", () => {
    for (const date of ["2026-02-30", "2026-13-01", "2026-04-31"]) {
      assert.equal(
        frontmatterSchema.safeParse({ ...sample, date }).success,
        false,
        date
      );
    }
    assert.ok(
      frontmatterSchema.safeParse({ ...sample, date: "2028-02-29" }).success
    );
    assert.equal(
      frontmatterSchema.safeParse({ ...sample, date: "2026-02-29" }).success,
      false
    );
  });

  it("rejects a time, wrong padding and other shapes", () => {
    for (const date of [
      "2026-10-20T09:00",
      "2026-10-20T00:00:00Z",
      "2026-10-20 09:00",
      "2026-1-5",
      "2026-10-5",
      "26-10-20",
      "2026/10/20",
      "",
    ]) {
      assert.equal(
        frontmatterSchema.safeParse({ ...sample, date }).success,
        false,
        date
      );
      assert.equal(
        frontmatterSchema.safeParse({ ...sample, updated: date }).success,
        false,
        date
      );
    }
  });

  it("explains the date format in the error", () => {
    const result = frontmatterSchema.safeParse({ ...sample, date: "soon" });
    assert.match(result.error?.issues[0]?.message ?? "", /YYYY-MM-DD/);
    assert.match(result.error?.issues[0]?.message ?? "", /Vienna/);
  });

  it("gives updated its own error text", () => {
    const result = frontmatterSchema.safeParse({ ...sample, updated: "soon" });
    assert.deepEqual(result.error?.issues[0]?.path, ["updated"]);
    assert.match(result.error?.issues[0]?.message ?? "", /YYYY-MM-DD/);
    assert.doesNotMatch(result.error?.issues[0]?.message ?? "", /Vienna|live/);
  });

  it("accepts an updated date on or after the date", () => {
    for (const updated of ["2026-10-13", "2026-10-14", "2027-01-01"]) {
      assert.ok(
        frontmatterSchema.safeParse({ ...sample, updated }).success,
        updated
      );
    }
  });

  it("rejects an updated date before the date", () => {
    const result = frontmatterSchema.safeParse({
      ...sample,
      updated: "2026-10-12",
    });
    assert.equal(result.success, false);
    assert.deepEqual(result.error?.issues[0]?.path, ["updated"]);
    assert.match(result.error?.issues[0]?.message ?? "", /before date/);
  });

  it("lists every weather state and the four phases", () => {
    assert.deepEqual(
      [...weatherStates].toSorted((a, b) => a.localeCompare(b)),
      Object.keys(weatherPresets).toSorted((a, b) => a.localeCompare(b))
    );
  });
});
