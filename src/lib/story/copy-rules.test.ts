import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { copyNumbers, lintCopy } from "./copy-rules.ts";
import { sampleFacts } from "./sample-facts.ts";
import { type StoryStep } from "./steps.ts";

const allowed = copyNumbers(sampleFacts);
const dash = String.fromCodePoint(0x20_14);

const sentence = (count: number): string => `${"word ".repeat(count - 1)}end.`;

const base: StoryStep = {
  eyebrow: "01",
  id: "c01",
  line: "Plain git. No manager.",
  note: "The repo is the source of truth. Every file is a link back into it.",
  screens: 1,
  tick: true,
};

const lint = (patch: Partial<StoryStep>): string[] =>
  lintCopy({ ...base, ...patch }, allowed);

describe("lintCopy", () => {
  it("accepts a clean step", () => {
    assert.deepEqual(lint({}), []);
  });
  it("flags a line of eight words", () => {
    const messages = lint({ line: "A line that runs far past the limit" });
    assert.equal(messages.length, 1);
    assert.match(messages[0] ?? "", /line has 8 words/u);
  });
  it("flags a line of two words", () => {
    assert.match(lint({ line: "Too short" })[0] ?? "", /line has 2 words/u);
  });
  it("lets the title steps keep a short line", () => {
    assert.deepEqual(lint({ id: "hero", line: "dotfiles" }), []);
    assert.deepEqual(lint({ id: "harness", line: "The harness" }), []);
  });
  it("flags a note of 56 words and accepts 55", () => {
    assert.match(
      lint({ note: `${sentence(28)} ${sentence(28)}` })[0] ?? "",
      /note has 56 words/u
    );
    assert.deepEqual(lint({ note: `${sentence(27)} ${sentence(28)}` }), []);
  });
  it("flags a note with one sentence or five", () => {
    assert.match(lint({ note: "Just one sentence." })[0] ?? "", /1 sentences/u);
    assert.match(
      lint({ note: "Aa. Bb. Cc. Dd. Ee." })[0] ?? "",
      /5 sentences/u
    );
  });
  it("flags an em dash", () => {
    assert.match(
      lint({
        note: `The repo is the source ${dash} of truth. It is plain.`,
      })[0] ?? "",
      /em dash/u
    );
  });
  it("flags a banned word", () => {
    assert.match(
      lint({ note: "The setup is seamless. It runs fast." })[0] ?? "",
      /banned word "seamless"/u
    );
  });
  it("flags a question mark and an exclamation mark", () => {
    assert.match(
      lint({ note: "Why plain git? Because it works." })[0] ?? "",
      /question/u
    );
    assert.match(
      lint({ note: "It works! It is plain." })[0] ?? "",
      /exclamation/u
    );
  });
  it("flags a city name", () => {
    assert.match(
      lint({ note: "I built it in Vienna. It is plain." })[0] ?? "",
      /city name/u
    );
  });
  it("flags a typed number that is not a fact", () => {
    const messages = lint({ note: "It is about 500 lines. It is plain." });
    assert.equal(messages.length, 1);
    assert.match(messages[0] ?? "", /number 500/u);
  });
  it("flags a spelled number that is not a fact", () => {
    assert.match(
      lint({ note: "It runs on nine systems. It is plain." })[0] ?? "",
      /number nine/u
    );
  });
  it("accepts numbers that come from the facts and the meta", () => {
    assert.deepEqual(
      lint({ note: "It has 39 tools and 769 tests. It is plain." }),
      []
    );
    const messages = lint({
      note: "It has three systems and 4,000 tests. It is plain.",
    });
    assert.equal(messages.length, 1);
    assert.match(messages[0] ?? "", /number 4,000/u);
  });
  it("does not check the eyebrow or the strip", () => {
    assert.deepEqual(
      lint({
        eyebrow: "H1",
        strip: { command: "ls", output: [`12345 ${dash} why?`] },
      }),
      []
    );
  });
});

describe("copyNumbers", () => {
  it("holds the facts, the meta and the rounded Rust share", () => {
    for (const value of [
      243, 39, 18, 769, 8, 3, 5, 17, 2, 6, 300, 45, 1, 0, 91,
    ]) {
      assert.ok(allowed.has(value), String(value));
    }
    assert.equal(allowed.has(500), false);
  });
});
