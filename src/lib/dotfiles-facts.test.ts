import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  checkFacts,
  countGuardChecks,
  countHookEvents,
  countRustPrograms,
  countTree,
  parseBlobTexts,
  parseTree,
} from "./dotfiles-facts.ts";
import { sampleFacts } from "./story/sample-facts.ts";

describe("checkFacts", () => {
  it("passes the sample", () => {
    assert.equal(checkFacts(sampleFacts), sampleFacts);
  });
  it("throws when a counted fact is 0", () => {
    assert.throws(
      () => checkFacts({ ...sampleFacts, presets: 0 }),
      /presets is 0/u
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
  blob("claude/output-styles/concise.md"),
  blob("claude/output-styles/README.md"),
  blob("home/.zshrc"),
];

describe("countTree", () => {
  it("counts files and path patterns", () => {
    assert.deepEqual(countTree(entries), {
      agents: 1,
      homeFiles: 1,
      outputStyles: 1,
      presets: 1,
      skillNames: ["ps:pick"],
      skills: 1,
    });
  });
  it("does not count folders as files", () => {
    assert.equal(
      countTree([...entries, { path: "home/.config", type: "tree" }]).homeFiles,
      1
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
        cargo: { text: "c" },
        guard: { text: "g" },
        hooks: { text: "h" },
      },
    },
  };
  it("reads the three texts", () => {
    assert.deepEqual(parseBlobTexts(data), {
      cargo: "c",
      guard: "g",
      hooks: "h",
    });
  });
  it("throws on a missing blob", () => {
    assert.throws(() =>
      parseBlobTexts({
        data: { repository: { ...data.data.repository, cargo: null } },
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
  it("counts hook events", () => {
    assert.equal(countHookEvents('{"hooks":{"PreToolUse":[],"Stop":[]}}'), 2);
  });
  it("counts unique guard checks", () => {
    assert.equal(countGuardChecks('"G1" "G14" "W5" "H1" "G1"'), 4);
  });
  it("ignores guard checks in the test module", () => {
    assert.equal(countGuardChecks('"G1"\n#[cfg(test)]\n"G99"'), 1);
  });
  it("counts the binaries of a Cargo manifest", () => {
    assert.equal(
      countRustPrograms(
        '[package]\nname = "a"\n\n[[bin]]\nname = "a"\n\n[[bin]]\nname = "b"\n[[bench]]\n'
      ),
      2
    );
  });
});
