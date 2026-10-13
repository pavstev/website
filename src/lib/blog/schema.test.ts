import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { frontmatterSchema } from "./schema.ts";

const sample = {
  date: "2026-10-13T09:30:00+02:00",
  description: "A short post about the sky.",
  tags: ["WebGL"],
  title: "A post",
};

describe("frontmatterSchema", () => {
  it("parses a valid sample and defaults draft to false", () => {
    const parsed = frontmatterSchema.parse(sample);
    assert.equal(parsed.draft, false);
    assert.equal(parsed.updated, undefined);
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

  it("rejects the retired sky field", () => {
    const result = frontmatterSchema.safeParse({
      ...sample,
      sky: { phase: "night", weather: "clear" },
    });
    assert.equal(result.success, false);
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

  it("rejects a date that is not an ISO date and time", () => {
    assert.equal(
      frontmatterSchema.safeParse({ ...sample, date: "13.10.2026" }).success,
      false
    );
  });

  it("rejects a day that is not on the calendar", () => {
    for (const day of [
      "2026-02-30",
      "2026-13-01",
      "2026-04-31",
      "2026-02-29",
    ]) {
      assert.equal(
        frontmatterSchema.safeParse({
          ...sample,
          date: `${day}T09:00:00+01:00`,
        }).success,
        false,
        day
      );
    }
    assert.ok(
      frontmatterSchema.safeParse({
        ...sample,
        date: "2028-02-29T09:00:00+01:00",
      }).success
    );
  });

  it("accepts any valid offset", () => {
    for (const date of [
      "2026-10-13T09:30:00+02:00",
      "2026-12-13T09:30:00+01:00",
      "2026-10-13T09:30:00-05:00",
      "2026-10-13T09:30:00+05:30",
      "2026-10-13T09:30:00+00:00",
    ]) {
      assert.ok(frontmatterSchema.safeParse({ ...sample, date }).success, date);
    }
  });

  it("rejects a date alone, Z, a missing offset or seconds and other shapes", () => {
    for (const date of [
      "2026-10-20",
      "2026-10-20T09:00",
      "2026-10-20T09:00+02:00",
      "2026-10-20T09:00:00",
      "2026-10-20T09:00:00Z",
      "2026-10-20T09:00:00.000+02:00",
      "2026-10-20 09:00:00+02:00",
      "2026-10-20T24:00:00+02:00",
      "2026-10-20T09:60:00+02:00",
      "2026-10-20T09:00:00+2:00",
      "2026-10-20T09:00:00+15:00",
      "2026/10/20T09:00:00+02:00",
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

  it("shows the expected form in the error", () => {
    for (const date of ["soon", "2026-10-13"]) {
      const result = frontmatterSchema.safeParse({ ...sample, date });
      assert.deepEqual(result.error?.issues[0]?.path, ["date"]);
      assert.match(
        result.error?.issues[0]?.message ?? "",
        /2026-10-13T09:30:00\+02:00/
      );
    }
  });

  it("gives updated the same error text under its own path", () => {
    const result = frontmatterSchema.safeParse({ ...sample, updated: "soon" });
    assert.deepEqual(result.error?.issues[0]?.path, ["updated"]);
    assert.match(result.error?.issues[0]?.message ?? "", /offset/);
  });

  it("accepts an updated instant on or after the date, in any offset", () => {
    for (const updated of [
      "2026-10-13T09:30:00+02:00",
      "2026-10-13T08:30:00+01:00",
      "2026-10-14T00:00:00+02:00",
    ]) {
      assert.ok(
        frontmatterSchema.safeParse({ ...sample, updated }).success,
        updated
      );
    }
  });

  it("rejects an updated instant before the date", () => {
    const result = frontmatterSchema.safeParse({
      ...sample,
      updated: "2026-10-13T08:29:59+01:00",
    });
    assert.equal(result.success, false);
    assert.deepEqual(result.error?.issues[0]?.path, ["updated"]);
    assert.match(result.error?.issues[0]?.message ?? "", /before date/);
  });
});
