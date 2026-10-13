import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { diagramMeta, diagramNames, diagramText } from "./diagrams.ts";

describe("diagramText", () => {
  it("returns the description of every registered diagram", () => {
    for (const name of diagramNames)
      assert.equal(diagramText(name), diagramMeta[name].desc);
  });

  it("fails on an unknown name", () => {
    assert.throws(() => diagramText("nope"), /Unknown diagram "nope"/);
  });

  it("keeps the copy free of em dashes", () => {
    for (const name of diagramNames) {
      assert.doesNotMatch(diagramMeta[name].desc, /\u{2014}/u);
      assert.doesNotMatch(diagramMeta[name].title, /\u{2014}/u);
    }
  });
});
