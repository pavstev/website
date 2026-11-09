import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  checkFacts,
  countGuardChecks,
  countHarness,
  countHomeFiles,
  countHookEvents,
  countRustPrograms,
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
  blob("plugins/ps/skills/pick/SKILL.md"),
  blob("plugins/ps/skills/pick/scripts/pick.sh"),
  blob("plugins/ps/skills/README.md"),
  blob("plugins/ps/agents/worker.md"),
  blob("plugins/ps/agents/README.md"),
  blob("plugins/ps/presets/clock/rules.md"),
  blob("plugins/ps/output-styles/concise.md"),
  blob("plugins/ps/output-styles/README.md"),
  blob("home/.zshrc"),
];

describe("countHarness", () => {
  it("counts the plugin paths", () => {
    assert.deepEqual(countHarness(entries), {
      agents: 1,
      outputStyles: 1,
      presets: 1,
      skillNames: ["ps:pick"],
      skills: 1,
    });
  });
});

describe("countHomeFiles", () => {
  it("counts files under home", () => {
    assert.equal(countHomeFiles(entries), 1);
  });
  it("does not count folders as files", () => {
    assert.equal(
      countHomeFiles([...entries, { path: "home/.config", type: "tree" }]),
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
  const harness = {
    cargo: { text: "c" },
    guard: { text: "g" },
    hooks: { text: "h" },
  };
  const data = { data: { dotfiles: { cargo: { text: "d" } }, harness } };
  it("reads the four texts", () => {
    assert.deepEqual(parseBlobTexts(data), {
      dotfilesCargo: "d",
      guard: "g",
      harnessCargo: "c",
      hooks: "h",
    });
  });
  it("throws on a missing repository", () => {
    assert.throws(() => parseBlobTexts({ data: { dotfiles: null, harness } }));
  });
  it("throws on a missing blob", () => {
    assert.throws(() =>
      parseBlobTexts({
        data: { ...data.data, harness: { ...harness, cargo: null } },
      })
    );
  });
  it("throws on a blob without text", () => {
    assert.throws(() =>
      parseBlobTexts({
        data: { ...data.data, harness: { ...harness, guard: {} } },
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
        '[package]\nname = "a"\n\n[[bin]]\nname = "a"\n\n[[bin]]\nname = "b"\n[[bench]]\nname = "c"\n'
      ),
      2
    );
  });
  it("counts a binary in two manifests once", () => {
    assert.equal(
      countRustPrograms(
        '[[bin]]\nname = "dots"\n[[bin]]\nname = "port"\n',
        '[[bin]]\npath = "src/guard.rs"\nname = "guard"\n[[bin]]\nname = "port"\n'
      ),
      3
    );
  });
});
