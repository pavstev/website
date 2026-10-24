import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  fadeTo,
  moveTo,
  type Placed,
  translateOf,
  wirePath,
} from "./story-dom.ts";

interface Spy extends Placed {
  writes: string[];
}

const spy = (alpha = -1): Spy => {
  const writes: string[] = [];
  const style = {
    get opacity(): string {
      return "";
    },
    set opacity(value: string) {
      writes.push(`opacity ${value}`);
    },
    get transform(): string {
      return "";
    },
    set transform(value: string) {
      writes.push(`transform ${value}`);
    },
  };
  return { alpha, at: "", el: { style }, writes };
};

describe("translateOf", () => {
  it("rounds to a tenth of a pixel", () => {
    assert.equal(translateOf(10.04, -3.26), "translate3d(10.0px,-3.3px,0)");
  });
});

describe("moveTo", () => {
  it("writes the transform once for the same spot", () => {
    const item = spy();
    moveTo(item, 12, 40);
    moveTo(item, 12, 40);
    moveTo(item, 12.01, 40.02);
    assert.deepEqual(item.writes, ["transform translate3d(12.0px,40.0px,0)"]);
  });

  it("writes again when the spot moves", () => {
    const item = spy();
    moveTo(item, 0, 0);
    moveTo(item, 0, 1);
    assert.equal(item.writes.length, 2);
    assert.equal(item.at, "translate3d(0.0px,1.0px,0)");
  });
});

describe("fadeTo", () => {
  it("writes the opacity only when the alpha changes", () => {
    const item = spy();
    fadeTo(item, 0.5);
    fadeTo(item, 0.5);
    fadeTo(item, 0);
    fadeTo(item, 0);
    assert.deepEqual(item.writes, ["opacity 0.50", "opacity 0.00"]);
  });

  it("skips the first write when the alpha already matches", () => {
    const item = spy(0);
    fadeTo(item, 0);
    assert.deepEqual(item.writes, []);
  });
});

describe("wirePath", () => {
  it("drops down to the middle, then runs to the anchor", () => {
    assert.equal(wirePath(100, 50, 300, 250), "M100.0 50.0V150.0L300.0 250.0");
  });
});
