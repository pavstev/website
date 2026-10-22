import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  skillCopy,
  skillFacts,
  skillUsage,
  storyNumbers,
} from "../../data/dotfiles-story.ts";
import { copyNumbers, lintCopy, lintFact, lintSkill } from "./copy-rules.ts";
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
    const allowed = copyNumbers(sampleFacts, skillUsage);
    for (const step of steps) {
      assert.deepEqual(lintCopy(step, allowed), [], step.id);
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
  it("types no fact by hand", () => {
    const sentinel = {
      ...sampleFacts,
      agents: 1013,
      files: 1019,
      forks: 1021,
      guardChecks: 1031,
      homeFiles: 1033,
      hookEvents: 1039,
      installSteps: 1049,
      presets: 1051,
      rustShare: 0.1061,
      skills: 1063,
      stars: 1069,
      tools: 1087,
    };
    const allowed = copyNumbers(sentinel, skillUsage);
    for (const step of buildSteps(sentinel)) {
      assert.deepEqual(lintCopy(step, allowed), [], step.id);
    }
  });
  it("writes the facts into the copy", () => {
    const text = steps.map((step) => `${step.line} ${step.note}`).join(" ");
    assert.ok(text.includes("39 tools"));
    const changed = buildSteps({ ...sampleFacts, tools: 41 });
    assert.match(changed[0]?.note ?? "", /41 tools/u);
  });
});

describe("skill copy", () => {
  const sentinel = structuredClone(skillUsage);
  for (const [k, item] of sentinel.skills.entries()) {
    if (item.share > 0) item.share = 0.1001 + k / 1000;
    if (item.outcome) item.outcome.share = 0.2003 + k / 1000;
  }
  for (const [k, item] of sentinel.phases.entries())
    item.share = 0.3007 + k / 1000;
  for (const [k, item] of sentinel.chains.entries())
    item.share = 0.4009 + k / 1000;
  sentinel.shares.ownerSessionsWithSkill = 0.5011;
  sentinel.shares.agentStarted = 0.6013;
  sentinel.period = { from: "2026-09-04", to: "2026-09-27" };
  for (const point of sentinel.trend) point.share = 0.7019;

  it("passes every copy rule for every skill", () => {
    const allowed = copyNumbers(sampleFacts, skillUsage);
    const copy = skillCopy();
    assert.equal(copy.length, skillUsage.skills.length);
    for (const item of copy) assert.deepEqual(lintSkill(item, allowed), []);
    for (const line of skillFacts())
      assert.deepEqual(lintFact(line, allowed), []);
  });
  it("types no share or date by hand", () => {
    const allowed = copyNumbers(sampleFacts, sentinel);
    for (const item of skillCopy(sentinel))
      assert.deepEqual(lintSkill(item, allowed), [], item.skill);
    for (const line of skillFacts(sentinel))
      assert.deepEqual(lintFact(line, allowed), []);
    const walk = buildSteps(sampleFacts, sentinel).find(
      (step) => step.id === "skills"
    );
    assert.ok(walk);
    assert.deepEqual(lintCopy(walk, allowed), []);
    assert.match(walk.note, /4 September to 27 September/u);
    assert.match(walk.note, /50% of the sessions/u);
  });
  it("shows a skill the data does not know yet as new", () => {
    const copy = skillCopy(skillUsage, [
      ...sampleFacts.skillNames,
      "ps:zz-new",
    ]);
    assert.deepEqual(copy.at(-1), {
      metric: "New, no run yet.",
      phase: "care",
      skill: "ps:zz-new",
      what: "A new skill in the harness.",
    });
    const allowed = copyNumbers(sampleFacts, skillUsage);
    for (const item of copy) assert.deepEqual(lintSkill(item, allowed), []);
  });
  it("never says 0% for a skill that ran", () => {
    for (const item of skillCopy()) assert.doesNotMatch(item.metric, /^0%/u);
  });
  it("says new, no run yet for the skills with no run", () => {
    const idle = skillCopy().filter(
      (item) => item.metric === "New, no run yet."
    );
    assert.equal(
      idle.length,
      skillUsage.skills.filter((item) => item.share === 0).length
    );
  });
});

describe("storyNumbers", () => {
  it("lists the hero numbers in order", () => {
    assert.deepEqual(storyNumbers(sampleFacts).hero, [
      { label: "files", value: 250 },
      { label: "tools", value: 39 },
      { label: "steps", value: 17 },
      { label: "skills", value: 17 },
      { label: "agents", value: 8 },
      { label: "guard checks", value: 19 },
    ]);
  });
  it("lists the harness numbers in order", () => {
    assert.deepEqual(storyNumbers(sampleFacts).harness, [
      { label: "guard checks", value: 19 },
      { label: "skills", value: 17 },
      { label: "agents", value: 8 },
      { label: "presets", value: 7 },
    ]);
  });
});
