import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cornerMeteor, meteorStart, rayView } from "./sky-rays.ts";

describe("rayView", () => {
  it("is a share of the height", () => {
    assert.equal(rayView(500), 360);
  });

  it("stops growing on tall windows", () => {
    assert.equal(rayView(2000), 960);
  });
});

describe("meteorStart", () => {
  it("keeps the corner path on a wide view", () => {
    const start = meteorStart(1584, 396, 285);
    assert.equal(start.x, cornerMeteor.x);
    assert.equal(start.angle, cornerMeteor.angle);
    assert.ok(Math.abs(start.y - (396 / 285 / 2 - 0.12)) < 1e-9);
  });

  it("pulls the start left on a narrow view", () => {
    const start = meteorStart(300, 600, 400);
    assert.ok(start.x < cornerMeteor.x);
  });
});
