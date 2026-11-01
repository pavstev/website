import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { splitBio, splitCompounds } from "./bio.ts";

describe("splitBio", () => {
  it("cuts the summary around each term in reading order", () => {
    const parts = splitBio("I build fintech and fleet logistics in Belgrade.", [
      { word: "Belgrade" },
      { word: "fintech" },
      { word: "fleet logistics" },
    ]);
    assert.deepEqual(parts, [
      { text: "I build " },
      { tail: "", term: { word: "fintech" } },
      { text: " and " },
      { tail: "", term: { word: "fleet logistics" } },
      { text: " in " },
      { tail: ".", term: { word: "Belgrade" } },
    ]);
  });

  it("marks only the first match of a term", () => {
    assert.deepEqual(splitBio("Belgrade, Belgrade", [{ word: "Belgrade" }]), [
      { tail: ",", term: { word: "Belgrade" } },
      { text: " Belgrade" },
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

describe("splitCompounds", () => {
  it("keeps each hyphenated compound in its own piece", () => {
    assert.deepEqual(
      splitCompounds("a backend and distributed-systems engineer living in "),
      [
        { compound: false, text: "a backend and " },
        { compound: true, text: "distributed-systems" },
        { compound: false, text: " engineer living in " },
      ]
    );
  });

  it("keeps punctuation with the compound and finds several", () => {
    assert.deepEqual(splitCompounds("on-device, real-time."), [
      { compound: true, text: "on-device," },
      { compound: false, text: " " },
      { compound: true, text: "real-time." },
    ]);
  });

  it("leaves text without a compound whole", () => {
    assert.deepEqual(splitCompounds(" - and so - on "), [
      { compound: false, text: " - and so - on " },
    ]);
  });
});
