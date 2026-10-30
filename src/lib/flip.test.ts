import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { flipFrames } from "./flip.ts";

describe("flipFrames", () => {
  it("skips a hidden card", () => {
    assert.equal(flipFrames({ x: 0, y: 0 }, null), null);
  });
  it("skips a card that did not move", () => {
    assert.equal(flipFrames({ x: 4, y: 8 }, { x: 4.2, y: 8 }), null);
  });
  it("slides a moved card from its old place", () => {
    assert.deepEqual(flipFrames({ x: 100, y: 0 }, { x: 0, y: 50 }), [
      { transform: "translate(100px, -50px)" },
      { transform: "none" },
    ]);
  });
  it("lifts a card that was hidden before", () => {
    assert.deepEqual(flipFrames(null, { x: 0, y: 0 }), [
      { transform: "translateY(0.5rem) scale(0.98)" },
      { transform: "none" },
    ]);
  });
});
