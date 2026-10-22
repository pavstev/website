import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  checkFacts,
  countDistros,
  countDoctorChecks,
  countGuardChecks,
  countHookEvents,
  countInstallSteps,
  countRustPrograms,
  countTests,
  countTools,
  countTree,
  parseBlobTexts,
  parseSources,
  parseTree,
  rustShareOf,
  rustSources,
  sourcesQuery,
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
  blob("claude/output-styles/concise.md"),
  blob("claude/output-styles/README.md"),
  blob("home/.zshrc"),
];

describe("countTree", () => {
  it("counts files and path patterns", () => {
    assert.deepEqual(countTree(entries), {
      agents: 1,
      files: 8,
      homeFiles: 1,
      outputStyles: 1,
      presets: 1,
      skillNames: ["ps:pick"],
      skills: 1,
    });
  });
  it("does not count folders as files", () => {
    assert.equal(
      countTree([...entries, { path: "home", type: "tree" }]).files,
      8
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
        doctor: { text: "d" },
        guard: { text: "g" },
        hooks: { text: "h" },
        install: { text: "i" },
        readme: { text: "r" },
        tools: { text: "t" },
      },
    },
  };
  it("reads the seven texts", () => {
    assert.deepEqual(parseBlobTexts(data), {
      cargo: "c",
      doctor: "d",
      guard: "g",
      hooks: "h",
      install: "i",
      readme: "r",
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

describe("rust sources", () => {
  const paths = ["rust/a/src/lib.rs", "rust/a/tests/guard.rs"];
  it("lists the Rust files outside the fixtures", () => {
    assert.deepEqual(
      rustSources([
        blob("rust/a/src/lib.rs"),
        blob("rust/a/tests/guard.rs"),
        blob("rust/a/tests/fixtures/codeview/items.rs"),
        blob("rust/a/Cargo.toml"),
        blob("scripts/tool.rs"),
        { path: "rust/a/src", type: "tree" },
      ]),
      paths
    );
  });
  it("asks for each file by its own alias", () => {
    const query = sourcesQuery(paths);
    assert.match(
      query,
      /s0: object\(expression: "HEAD:rust\/a\/src\/lib\.rs"\)/u
    );
    assert.match(
      query,
      /s1: object\(expression: "HEAD:rust\/a\/tests\/guard\.rs"\)/u
    );
  });
  it("reads the texts in path order", () => {
    const data = {
      data: {
        repository: {
          s0: { isTruncated: false, text: "a" },
          s1: { isTruncated: false, text: "b" },
        },
      },
    };
    assert.deepEqual(parseSources(data, paths), ["a", "b"]);
  });
  it("throws on a missing or truncated file", () => {
    assert.throws(
      () =>
        parseSources(
          { data: { repository: { s0: { isTruncated: false, text: "a" } } } },
          paths
        ),
      /missing source rust\/a\/tests\/guard\.rs/u
    );
    assert.throws(() =>
      parseSources(
        {
          data: {
            repository: {
              s0: { isTruncated: false, text: "a" },
              s1: { isTruncated: true, text: "b" },
            },
          },
        },
        paths
      )
    );
    assert.throws(() =>
      parseSources(
        {
          data: {
            repository: { s0: { isTruncated: false, text: "a" }, s1: null },
          },
        },
        paths
      )
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
  it("counts the binaries of a Cargo manifest", () => {
    assert.equal(
      countRustPrograms(
        '[package]\nname = "a"\n\n[[bin]]\nname = "a"\n\n[[bin]]\nname = "b"\n[[bench]]\n'
      ),
      2
    );
  });
  it("counts test attributes at the start of a line", () => {
    assert.equal(
      countTests([
        "#[test]\nfn a() {}\n    #[test]\n    fn b() {}",
        'let s = "#[test]";\n#[cfg(unix)]\n#[test]\nfn c() {}',
      ]),
      3
    );
  });
  it("counts unique doctor checks outside the test module", () => {
    assert.equal(
      countDoctorChecks(
        'vec![\n        c("links", links(repo, home)),\n        c("no-leak", no_leak(repo, home)),\n        c("links", links(repo, home)),\n    ]\n#[cfg(test)]\n        c("fake", fake()),'
      ),
      2
    );
  });
  it("counts the Linux distros the readme names", () => {
    assert.equal(
      countDistros(
        "Runs on **macOS**, **Linux** (Debian, Ubuntu, Fedora, Arch, Alpine) and **Windows**."
      ),
      5
    );
  });
  it("gives zero distros when the readme drops the list", () => {
    assert.equal(countDistros("Runs on **Linux** and **Windows**."), 0);
  });
  it("gives the Rust share of all bytes", () => {
    assert.equal(rustShareOf({ Rust: 900, Shell: 100 }), 0.9);
  });
  it("gives zero for no bytes", () => {
    assert.equal(rustShareOf({}), 0);
  });
});
