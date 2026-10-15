import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { feedAnswer, servedCv } from "./cv-sample.ts";
import { type Cv, cvSchema, getCv, parseCv, stripPrivate } from "./cv.ts";

const sample = {
  basics: { headline: "Engineer", name: "Ada Example", phone: "+43 1 234" },
  experience: {
    items: [
      { company: "Example", from: "Jan 2020", position: "Lead", to: "Present" },
    ],
  },
  projects: {
    items: [
      {
        name: "Ledger",
        overview: "A double-entry ledger.",
        websiteUrl: "https://example.com/ledger",
      },
    ],
  },
  updatedAt: "2026-10-08T00:00:00.000Z",
};

const failureOf = (work: () => unknown): Error => {
  try {
    work();
  } catch (error) {
    assert.ok(error instanceof Error, "expected an Error");
    return error;
  }
  return assert.fail("expected a throw");
};

describe("parseCv", () => {
  it("blanks the phone and fills defaults", () => {
    const cv = parseCv(sample, "sample");
    assert.equal(cv.basics.phone, "");
    assert.equal(cv.basics.name, "Ada Example");
    assert.equal(cv.basics.location, "");
    assert.deepEqual(cv.education.items, []);
    assert.equal(cv.experience.items[0]?.overview, "");
  });
  it("serves exactly the shape the Worker sample reads", () => {
    const expected: Cv = servedCv;
    assert.deepEqual(parseCv(feedAnswer, "sample"), expected);
  });
  it("keeps the projects section", () => {
    const cv = parseCv(sample, "sample");
    assert.equal(cv.projects.items.length, 1);
    assert.equal(cv.projects.items[0]?.name, "Ledger");
    assert.equal(
      cv.projects.items[0]?.websiteUrl,
      "https://example.com/ledger"
    );
  });
  it("names the file and the field that fail the schema", () => {
    const failure = failureOf(() =>
      parseCv({ ...sample, updatedAt: "yesterday" }, "src/data/cv.json")
    );
    assert.match(failure.message, /^src\/data\/cv\.json/);
    assert.match(failure.message, /updatedAt/);
  });
});

describe("getCv", () => {
  it("reads the committed résumé once and blanks the phone", async () => {
    const first = await getCv();
    assert.equal(first.basics.name, "Stevan Pavlović");
    assert.equal(first.basics.phone, "");
    assert.ok(Number.isFinite(Date.parse(first.updatedAt)));
    assert.ok(first.experience.items.length > 0);
    const second = await getCv();
    assert.equal(second, first);
  });
});

describe("cvSchema", () => {
  it("rejects a project link that is not http(s)", () => {
    const bad = {
      ...sample,
      projects: {
        items: [{ name: "X", websiteUrl: "javascript:alert(1)" }],
      },
    };
    assert.equal(cvSchema.safeParse(bad).success, false);
  });
  it("accepts an ISO time with an offset", () => {
    const parsed = cvSchema.parse({
      ...sample,
      updatedAt: "2026-10-08T00:00:00+02:00",
    });
    assert.equal(parsed.updatedAt, "2026-10-08T00:00:00+02:00");
  });
});

describe("stripPrivate", () => {
  it("blanks the phone and does not mutate its input", () => {
    const cv = cvSchema.parse(sample);
    const stripped = stripPrivate(cv);
    assert.equal(stripped.basics.phone, "");
    assert.equal(cv.basics.phone, "+43 1 234");
  });
});
