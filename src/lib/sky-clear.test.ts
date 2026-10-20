import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clearBox, clearUniform } from "./sky-clear.ts";

const card = { bottom: 723, left: 176, right: 1264, top: 125 };

describe("clearBox", () => {
  it("keeps the card height and spans the text width", () => {
    const box = clearBox(card, [
      { bottom: 407, left: 412, right: 1028, top: 301 },
      { bottom: 514, left: 432, right: 1008, top: 408 },
      { bottom: 723, left: 432, right: 1008, top: 646 },
    ]);
    assert.deepEqual(box, { bottom: 723, left: 412, right: 1028, top: 125 });
  });

  it("falls back to the card when no text has a width", () => {
    assert.deepEqual(clearBox(card, []), card);
    assert.deepEqual(
      clearBox(card, [{ bottom: 0, left: 5, right: 5, top: 0 }]),
      card
    );
  });
});

describe("clearUniform", () => {
  it("turns a page box into canvas pixels with y up from the bottom", () => {
    assert.deepEqual(
      clearUniform({ bottom: 723, left: 412, right: 1028, top: 125 }, 900, 0.5),
      [206, 88.5, 514, 387.5]
    );
  });

  it("is empty without a box or with a flat box", () => {
    assert.deepEqual(clearUniform(undefined, 900, 1), [0, 0, 0, 0]);
    assert.deepEqual(
      clearUniform({ bottom: 5, left: 9, right: 9, top: 1 }, 900, 1),
      [0, 0, 0, 0]
    );
  });
});
