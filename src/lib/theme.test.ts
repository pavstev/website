import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hexBytes } from "./theme.ts";

describe("hexBytes", () => {
  it("reads a six-digit hex color as three bytes", () => {
    assert.deepEqual(hexBytes("#000000"), [0, 0, 0]);
    assert.deepEqual(hexBytes("#ff8000"), [255, 128, 0]);
    assert.deepEqual(hexBytes("#0a0b0c"), [10, 11, 12]);
  });
});
