import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  checkFacts,
  countGuardChecks,
  countHookEvents,
  countInstallSteps,
  countTools,
  countTree,
  parseBlobTexts,
  parseTree,
  rustShareOf,
} from "./dotfiles-facts.ts";
import { sampleFacts } from "./story/sample-facts.ts";

describe("checkFacts", () => {
  it("lets forks and stars be 0", () => {
    const facts = { ...sampleFacts, forks: 0, stars: 0 };
    assert.equal(checkFacts(facts), facts);
  });
  it("throws when a counted fact is 0", () => {
    assert.throws(
      () => checkFacts({ ...sampleFacts, installSteps: 0 }),
      /installSteps is 0/u
    );
  });
});

const blob = (path: string): { path: string; type: string } => ({
  path,
  type: "blob",
});

const entries = [
  blob("claude/skills/ps_pick/SKILL.md"),
  blob("claude/skills/README.md"),
  blob("claude/agents/worker.md"),
  blob("claude/agents/README.md"),
  blob("claude/presets/pace/rules.md"),
  blob("home/.zshrc"),
];

describe("countTree", () => {
  it("counts files and path patterns", () => {
    assert.deepEqual(countTree(entries), {
      agents: 1,
      files: 6,
      homeFiles: 1,
      presets: 1,
      skillNames: ["ps:pick"],
      skills: 1,
    });
  });
  it("does not count folders as files", () => {
    assert.equal(
      countTree([...entries, { path: "home", type: "tree" }]).files,
      6
    );
  });
});

describe("parseTree", () => {
  it("returns the entries", () => {
    assert.deepEqual(parseTree({ tree: entries, truncated: false }), entries);
  });
  it("throws on a truncated tree", () => {
    assert.throws(
      () => parseTree({ tree: entries, truncated: true }),
      /tree truncated/u
    );
  });
});

describe("parseBlobTexts", () => {
  const data = {
    data: {
      repository: {
        guard: { text: "g" },
        hooks: { text: "h" },
        install: { text: "i" },
        tools: { text: "t" },
      },
    },
  };
  it("reads the four texts", () => {
    assert.deepEqual(parseBlobTexts(data), {
      guard: "g",
      hooks: "h",
      install: "i",
      tools: "t",
    });
  });
  it("throws on a missing blob", () => {
    assert.throws(() =>
      parseBlobTexts({
        data: { repository: { ...data.data.repository, tools: null } },
      })
    );
  });
  it("throws on a blob without text", () => {
    assert.throws(() =>
      parseBlobTexts({
        data: { repository: { ...data.data.repository, guard: {} } },
      })
    );
  });
});

describe("text counters", () => {
  it("counts tool lines that start with a letter", () => {
    assert.equal(countTools("# comment\nrg | ...\nfd | ...\n"), 2);
  });
  it("counts hook events", () => {
    assert.equal(countHookEvents('{"hooks":{"PreToolUse":[],"Stop":[]}}'), 2);
  });
  it("counts unique install steps", () => {
    assert.equal(
      countInstallSteps('"05-linux-prereqs" "10-homebrew" "05-linux-prereqs"'),
      2
    );
  });
  it("ignores step names in the test module", () => {
    assert.equal(
      countInstallSteps('"10-homebrew"\n#[cfg(test)]\n"15-winget" "99-none"'),
      1
    );
  });
  it("counts unique guard checks", () => {
    assert.equal(countGuardChecks('"G1" "G14" "W5" "H1" "G1"'), 4);
  });
  it("gives the Rust share of all bytes", () => {
    assert.equal(rustShareOf({ Rust: 900, Shell: 100 }), 0.9);
  });
  it("gives zero for no bytes", () => {
    assert.equal(rustShareOf({}), 0);
  });
});
