import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { seedOf } from "./hash.ts";

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
