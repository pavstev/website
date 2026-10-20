import assert from "node:assert/strict";
import { statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import sharp from "sharp";

import {
  moonMap,
  moonMapHeight,
  moonMapPath,
  moonMapWidth,
  stackMap,
} from "./moon-map.ts";

describe("moon map", () => {
  it("draws the same map every run", () =>
    assert.deepEqual(moonMap(), moonMap()));

  it("stacks albedo over height", () => {
    const rgba = moonMap();
    const gray = stackMap(rgba);
    assert.equal(gray.length, moonMapWidth * moonMapWidth);
    assert.equal(gray[0], rgba[0]);
    assert.equal(gray[moonMapWidth * moonMapHeight], rgba[1]);
  });

  it("keeps the committed map small", async () => {
    const file = path.join(import.meta.dirname, "..", moonMapPath);
    const meta = await sharp(file).metadata();
    assert.deepEqual([meta.width, meta.height], [512, 512]);
    assert.ok(statSync(file).size < 60_000);
  });
});
