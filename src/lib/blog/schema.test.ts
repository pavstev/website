import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { weatherPresets } from "../weather.ts";
import { frontmatterSchema, weatherStates } from "./schema.ts";

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

  it("lists every weather state and the four phases", () => {
    assert.deepEqual(
      [...weatherStates].toSorted((a, b) => a.localeCompare(b)),
      Object.keys(weatherPresets).toSorted((a, b) => a.localeCompare(b))
    );
  });
});
