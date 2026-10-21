import assert from "node:assert/strict";
import { test } from "node:test";

import { imageSize } from "./imgsize.ts";

test("reads a PNG header", () => {
  const png = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
  png.writeUInt32BE(13, 8);
  png.write("IHDR", 12, "latin1");
  png.writeUInt32BE(1200, 16);
  png.writeUInt32BE(630, 20);
  assert.deepEqual(imageSize(png), [1200, 630]);
});

test("reads a JPEG frame header after an APP0 segment", () => {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]);
  const sof = Buffer.from([
    0xff, 0xc0, 0x00, 0x0b, 0x08, 0x02, 0x76, 0x04, 0xb0, 0x01, 0x01, 0x11,
    0x00,
  ]);
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof]);
  assert.deepEqual(imageSize(jpeg), [1200, 630]);
});

test("returns undefined for other data", () => {
  const text = Buffer.from("not an image at all, just text");
  assert.equal(imageSize(text), undefined);
});
