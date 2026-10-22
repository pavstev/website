import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { skillEntries } from "../../data/dotfiles-story.ts";
import {
  gaugeSpot,
  isSkillMap,
  loopPhases,
  skillMap,
  skillSpots,
  stopAt,
  walkOf,
} from "./skill-map.ts";

const map = skillMap(skillEntries);

describe("skillMap", () => {
  it("puts every skill in work loop order", () => {
    assert.equal(map.stops.length, skillEntries.length);
    const order = map.stops.map((stop) => loopPhases.indexOf(stop.phase));
    assert.deepEqual(
      order,
      order.toSorted((a, b) => a - b)
    );
    assert.equal(map.stops[0]?.skill, "ps:askme");
    assert.equal(map.stops.at(-1)?.phase, "care");
  });

  it("takes the names it is given and draws a new skill dashed in care", () => {
    const names = ["ps:askme", "ps:zz-new", "ps:pick"];
    const some = skillMap(skillEntries, names);
    assert.deepEqual(
      some.stops.map((stop) => stop.skill),
      ["ps:askme", "ps:pick", "ps:zz-new"]
    );
    assert.deepEqual(some.stops[2], {
      known: false,
      links: 0,
      phase: "care",
      skill: "ps:zz-new",
    });
    assert.deepEqual(some.chains, []);
  });

  it("keeps a crowded phase apart", () => {
    const crowd = skillMap(skillEntries, [
      ...skillEntries.map((item) => item.skill),
      "ps:zz-a",
      "ps:zz-b",
    ]);
    const spots = skillSpots(crowd.stops);
    for (const [i, a] of spots.entries()) {
      const rest = spots.slice(i + 1);
      for (const b of rest) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 0.4);
    }
  });

  it("draws the hand-offs of the catalog and counts the links of each stop", () => {
    const handOffs = skillEntries.filter((item) => "next" in item);
    assert.equal(map.chains.length, handOffs.length);
    for (const chain of map.chains) assert.notEqual(chain.from, chain.to);
    const askme = map.stops.find((stop) => stop.skill === "ps:askme");
    assert.ok((askme?.links ?? 0) >= 2);
  });

  it("keeps phase shares in loop order", () => {
    assert.equal(map.phases.length, loopPhases.length);
    const total = map.phases.reduce((sum, share) => sum + share, 0);
    assert.ok(Math.abs(total - 1) < 0.01);
  });

  it("passes its own guard and refuses junk", () => {
    assert.ok(isSkillMap(structuredClone(map)));
    assert.equal(isSkillMap({ ...map, phases: [2] }), false);
    assert.equal(isSkillMap({ ...map, chains: [{ from: 0, to: 99 }] }), false);
    assert.equal(isSkillMap(null), false);
  });
});

describe("skillSpots", () => {
  const spots = skillSpots(map.stops);

  it("keeps every skill on the sheet and apart", () => {
    for (const spot of spots) {
      assert.ok(Math.abs(spot.x) < 2.45 && Math.abs(spot.z) < 1.75);
    }
    for (const [i, a] of spots.entries()) {
      const rest = spots.slice(i + 1);
      for (const b of rest) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 0.45);
    }
  });

  it("keeps the gauges off the skills", () => {
    for (const phase of loopPhases) {
      const gauge = gaugeSpot(phase);
      for (const spot of spots)
        assert.ok(Math.hypot(gauge.x - spot.x, gauge.z - spot.z) > 0.4);
    }
  });
});

describe("walkOf", () => {
  it("ends the walk one screen before the step ends", () => {
    assert.equal(walkOf(0, 18), 0);
    assert.equal(walkOf(18 / 20, 18), 1);
    assert.equal(walkOf(1, 18), 1);
    assert.equal(walkOf(0.5, 0), 0);
  });
});

describe("stopAt", () => {
  it("gives half a screen to each stop", () => {
    assert.deepEqual(stopAt(0, 17), { stop: 0, u: 0 });
    assert.equal(stopAt(0.5, 17).stop, 8);
    assert.deepEqual(stopAt(1, 17), { stop: 16, u: 1 });
    assert.deepEqual(stopAt(0.5, 0), { stop: 0, u: 0 });
  });
});
