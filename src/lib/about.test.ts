import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { aboutFacts, aboutRoad, yearsOfCode } from "./about.ts";
import { getCv } from "./cv.ts";

const cities = /vienna|belgrade|wien|beograd/iu;

const emDash = String.fromCodePoint(0x20_14);
const enDash = String.fromCodePoint(0x20_13);

describe("about", () => {
  it("builds one road entry per CV stint, in the owner's voice", async () => {
    const cv = await getCv();
    const road = aboutRoad(cv);
    assert.equal(road.length, cv.experience.items.length);
    assert.equal(road.filter((item) => item.now).length, 1);
    for (const item of road) {
      assert.ok(item.line.length <= 60, `${item.company}: line too long`);
      assert.doesNotMatch(
        item.line,
        /[.!?]$/u,
        `${item.company}: ends in a mark`
      );
      assert.ok(
        !item.line.includes(emDash) && !item.line.includes(enDash),
        `${item.company}: dash`
      );
      assert.doesNotMatch(item.line, cities, `${item.company}: names a city`);
      assert.match(item.years, /^(?:\d{4}|\d{4} to \d{4}|since \d{4})$/u);
    }
  });

  it("counts the years of code from the first stint", async () => {
    const cv = await getCv();
    assert.ok(yearsOfCode(cv) >= 11);
    const facts = aboutFacts(cv);
    assert.equal(facts.length, 3);
    assert.match(facts[0] ?? "", /^\d+ years of code$/u);
    for (const fact of facts) assert.doesNotMatch(fact, cities);
  });
});
