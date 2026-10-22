import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  skillCopy,
  skillEntries,
  skillFacts,
  storyNames,
} from "../../data/dotfiles-story.ts";
import { lintCopy, lintFact, lintSkill } from "./copy-rules.ts";
import { sampleFacts } from "./sample-facts.ts";
import { buildSteps } from "./steps.ts";

const order = [
  "hero",
  "c01",
  "c02",
  "c03",
  "c04",
  "c05",
  "c06",
  "harness",
  "h1",
  "h2",
  "h3",
  "skills",
  "outro",
];

describe("buildSteps", () => {
  const steps = buildSteps(sampleFacts);

  it("returns the thirteen steps in the spec order", () => {
    assert.deepEqual(
      steps.map((step) => step.id),
      order
    );
  });
  it("marks twelve steps as rail ticks and leaves the outro out", () => {
    assert.equal(steps.filter((step) => step.tick).length, 12);
    assert.equal(steps.find((step) => step.id === "outro")?.tick, false);
  });
  it("gives c02, h1 and h2 one and a half screens", () => {
    const long = steps.filter((step) => step.screens === 1.5);
    assert.deepEqual(
      long.map((step) => step.id),
      ["c02", "h1", "h2"]
    );
  });
  it("gives the skills walk half a screen per skill", () => {
    const walk = steps.find((step) => step.id === "skills");
    assert.equal(walk?.screens, sampleFacts.skillNames.length / 2 + 1);
  });
  it("passes every copy rule", () => {
    for (const step of steps) {
      assert.deepEqual(lintCopy(step), [], step.id);
    }
  });
  it("shows five ledger rows in h2", () => {
    const h2 = steps.find((step) => step.id === "h2");
    assert.equal(h2?.strip?.output.length, 5);
  });
  it("keeps every strip to a few lines", () => {
    for (const step of steps) {
      assert.ok((step.strip?.output.length ?? 0) <= 5, step.id);
    }
  });
  it("shows no fact as a number in any line or note", () => {
    const words = new Set(
      steps.flatMap((step) => `${step.line} ${step.note}`.split(/\W+/u))
    );
    for (const value of Object.values(sampleFacts)) {
      if (typeof value === "number" && value > 1)
        assert.equal(words.has(String(value)), false, String(value));
    }
  });
});

describe("skill copy", () => {
  it("passes every copy rule for every skill", () => {
    const copy = skillCopy();
    assert.equal(copy.length, skillEntries.length);
    for (const item of copy) assert.deepEqual(lintSkill(item), []);
    for (const line of skillFacts()) assert.deepEqual(lintFact(line), []);
  });
  it("names the hand-off of each skill", () => {
    const askme = skillCopy().find((item) => item.skill === "ps:askme");
    assert.equal(askme?.flow, "Hands on to handoff.");
    const video = skillCopy().find((item) => item.skill === "ps:yt-learn");
    assert.equal(video?.flow, "Works on its own.");
  });
  it("shows a skill the catalog does not know yet as new", () => {
    const copy = skillCopy([...sampleFacts.skillNames, "ps:zz-new"]);
    assert.deepEqual(copy.at(-1), {
      flow: "New in the harness.",
      phase: "care",
      skill: "ps:zz-new",
      what: "A new skill in the harness.",
    });
    for (const item of copy) assert.deepEqual(lintSkill(item), []);
  });
});

describe("storyNames", () => {
  it("names things and counts nothing", () => {
    for (const item of [...storyNames.hero, ...storyNames.harness]) {
      assert.ok(item.value.length > 0 && item.label.length > 0);
      assert.doesNotMatch(item.label, /\d/u);
    }
  });
});
