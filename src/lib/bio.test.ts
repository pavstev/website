import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { splitBio } from "./bio.ts";

describe("splitBio", () => {
  it("cuts the summary around each term in reading order", () => {
    const parts = splitBio("I build fintech and fleet logistics in Vienna.", [
      { word: "Vienna" },
      { word: "fintech" },
      { word: "fleet logistics" },
    ]);
    assert.deepEqual(parts, [
      { text: "I build " },
      { tail: "", term: { word: "fintech" } },
      { text: " and " },
      { tail: "", term: { word: "fleet logistics" } },
      { text: " in " },
      { tail: ".", term: { word: "Vienna" } },
    ]);
  });

  it("marks only the first match of a term", () => {
    assert.deepEqual(splitBio("Vienna, Vienna", [{ word: "Vienna" }]), [
      { tail: ",", term: { word: "Vienna" } },
      { text: " Vienna" },
    ]);
  });

  it("fails when a term is missing", () => {
    assert.throws(() => splitBio("Hi", [{ word: "betting" }]), /betting/);
  });

  it("fails when terms overlap", () => {
    assert.throws(
      () =>
        splitBio("fleet logistics", [
          { word: "fleet" },
          { word: "fleet logistics" },
        ]),
      /overlaps/
    );
  });
});
