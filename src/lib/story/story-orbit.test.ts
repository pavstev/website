import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createOrbit, orbitAt } from "./story-orbit.ts";

const limits = { max: 0.8, min: -0.5 };
const size = { height: 100, width: 100 };

const pointer = (
  type: string,
  x: number,
  y: number,
  pointerType = "mouse",
  button = 0
): Event =>
  Object.assign(new Event(type), {
    button,
    clientX: x,
    clientY: y,
    pointerId: 1,
    pointerType,
  });

const stage = (): EventTarget & {
  getBoundingClientRect: () => typeof size;
} => Object.assign(new EventTarget(), { getBoundingClientRect: () => size });

describe("orbitAt", () => {
  it("turns a full circle across the width and wraps", () => {
    const half = orbitAt({ pitch: 0, yaw: 0 }, { dx: 50, dy: 0 }, size, limits);
    assert.ok(Math.abs(Math.abs(half.yaw) - Math.PI) < 1e-9);
    const quarter = orbitAt(
      { pitch: 0, yaw: 0 },
      { dx: 125, dy: 0 },
      size,
      limits
    );
    assert.ok(Math.abs(quarter.yaw - Math.PI / 2) < 1e-9);
  });
  it("keeps the pitch inside the limits", () => {
    const up = orbitAt({ pitch: 0, yaw: 0 }, { dx: 0, dy: 500 }, size, limits);
    assert.equal(up.pitch, 0.8);
    const down = orbitAt(
      { pitch: 0, yaw: 0 },
      { dx: 0, dy: -500 },
      size,
      limits
    );
    assert.equal(down.pitch, -0.5);
  });
});

describe("createOrbit", () => {
  it("follows a mouse drag and stays where it is left", () => {
    const target = stage();
    let changes = 0;
    const orbit = createOrbit(target, { change: () => (changes += 1), limits });
    target.dispatchEvent(pointer("pointerdown", 0, 0));
    target.dispatchEvent(pointer("pointermove", 25, 10));
    target.dispatchEvent(pointer("pointerup", 25, 10));
    target.dispatchEvent(pointer("pointermove", 90, 90));
    assert.ok(Math.abs(orbit.yaw - Math.PI / 2) < 1e-9);
    assert.ok(Math.abs(orbit.pitch - Math.PI / 10) < 1e-9);
    assert.equal(changes, 1);
  });
  it("turns only on a sideways touch, so the page still scrolls", () => {
    const target = stage();
    const orbit = createOrbit(target, { change: () => undefined, limits });
    target.dispatchEvent(pointer("pointerdown", 0, 0, "touch"));
    target.dispatchEvent(pointer("pointermove", 25, 40, "touch"));
    assert.ok(orbit.yaw > 0);
    assert.equal(orbit.pitch, 0);
  });
  it("ignores a right click and resets on a double click", () => {
    const target = stage();
    const orbit = createOrbit(target, { change: () => undefined, limits });
    target.dispatchEvent(pointer("pointerdown", 0, 0, "mouse", 2));
    target.dispatchEvent(pointer("pointermove", 25, 0));
    assert.equal(orbit.yaw, 0);
    target.dispatchEvent(pointer("pointerdown", 0, 0));
    target.dispatchEvent(pointer("pointermove", 25, 0));
    target.dispatchEvent(pointer("pointercancel", 25, 0));
    assert.ok(orbit.yaw > 0);
    target.dispatchEvent(new Event("dblclick"));
    assert.equal(orbit.yaw, 0);
  });
  it("lets go of every listener on dispose", () => {
    const target = stage();
    const orbit = createOrbit(target, { change: () => undefined, limits });
    orbit.dispose();
    target.dispatchEvent(pointer("pointerdown", 0, 0));
    target.dispatchEvent(pointer("pointermove", 25, 0));
    assert.equal(orbit.yaw, 0);
  });
});
