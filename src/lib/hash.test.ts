import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createRandom, seedOf } from "./hash.ts";

describe("seedOf", () => {
  it("is the 32-bit FNV-1a hash", () => {
    assert.equal(seedOf(""), 2_166_136_261);
    assert.equal(seedOf("a"), 0xe4_0c_29_2c);
    assert.equal(seedOf("foobar"), 0xbf_9c_f9_68);
  });

  it("is stable and unsigned", () => {
    assert.equal(seedOf("pavstev"), seedOf("pavstev"));
    assert.ok(seedOf("pavstev") >= 0);
  });
});

describe("createRandom", () => {
  it("repeats for the same seed and stays in [0, 1)", () => {
    const a = createRandom(7);
    const b = createRandom(7);
    for (let index = 0; index < 50; index += 1) {
      const value = a();
      assert.equal(value, b());
      assert.ok(value >= 0 && value < 1);
    }
  });

  it("differs between seeds", () => {
    assert.notEqual(createRandom(1)(), createRandom(2)());
  });
});
