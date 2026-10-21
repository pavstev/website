import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { storyNumbers } from "../../data/dotfiles-story.ts";
import { copyNumbers, lintCopy } from "./copy-rules.ts";
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
  "outro",
];

describe("buildSteps", () => {
  const steps = buildSteps(sampleFacts);

  it("returns the twelve steps in the spec order", () => {
    assert.deepEqual(
      steps.map((step) => step.id),
      order
    );
  });
  it("marks eleven steps as rail ticks and leaves the outro out", () => {
    assert.equal(steps.filter((step) => step.tick).length, 11);
    assert.equal(steps.find((step) => step.id === "outro")?.tick, false);
  });
  it("gives c02, h1 and h2 one and a half screens", () => {
    const long = steps.filter((step) => step.screens === 1.5);
    assert.deepEqual(
      long.map((step) => step.id),
      ["c02", "h1", "h2"]
    );
  });
  it("passes every copy rule", () => {
    const allowed = copyNumbers(sampleFacts);
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
    const allowed = copyNumbers(sentinel);
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

describe("storyNumbers", () => {
  it("lists the hero numbers in order", () => {
    assert.deepEqual(storyNumbers(sampleFacts).hero, [
      { label: "files", value: 243 },
      { label: "tools", value: 39 },
      { label: "steps", value: 18 },
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
