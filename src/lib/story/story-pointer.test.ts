import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import {
  createPointerTilt,
  loopMayRun,
  motionAllowed,
} from "./story-pointer.ts";

const area = { height: 100, left: 0, top: 0, width: 100 };

const move = (x: number, y: number, pointerType = "mouse"): Event =>
  Object.assign(new Event("pointermove"), {
    clientX: x,
    clientY: y,
    pointerType,
  });

const settle = (tilt: { tick: (dt: number) => void }, steps: number): void => {
  for (let i = 0; i < steps; i += 1) tilt.tick(0.1);
};

describe("createPointerTilt", () => {
  it("leans to the right edge within a second", () => {
    const target = new EventTarget();
    const tilt = createPointerTilt(target, 3, 2, { area: () => area });
    target.dispatchEvent(move(100, 50));
    settle(tilt, 10);
    assert.ok(tilt.yaw > 2.5);
    assert.ok(tilt.yaw <= 3);
    assert.equal(tilt.pitch, 0);
  });

  it("maps the vertical position to the pitch", () => {
    const target = new EventTarget();
    const tilt = createPointerTilt(target, 3, 2, { area: () => area });
    target.dispatchEvent(move(50, 100));
    settle(tilt, 10);
    assert.ok(tilt.pitch > 1.8);
    assert.equal(tilt.yaw, 0);
  });

  it("clamps a pointer outside the area", () => {
    const target = new EventTarget();
    const tilt = createPointerTilt(target, 3, 2, { area: () => area });
    target.dispatchEvent(move(900, 50));
    settle(tilt, 40);
    assert.ok(tilt.yaw <= 3);
  });

  it("eases back to zero after the pointer leaves", () => {
    const target = new EventTarget();
    const tilt = createPointerTilt(target, 3, 2, { area: () => area });
    target.dispatchEvent(move(100, 50));
    settle(tilt, 10);
    target.dispatchEvent(new Event("pointerleave"));
    settle(tilt, 10);
    assert.ok(Math.abs(tilt.yaw) < 0.1);
  });

  it("reports settled only at rest", () => {
    const target = new EventTarget();
    const tilt = createPointerTilt(target, 3, 2, { area: () => area });
    assert.equal(tilt.settled(), true);
    target.dispatchEvent(move(100, 50));
    assert.equal(tilt.settled(), false);
    settle(tilt, 200);
    assert.equal(tilt.settled(), true);
    assert.equal(tilt.yaw, 3);
    target.dispatchEvent(new Event("pointerleave"));
    assert.equal(tilt.settled(), false);
    settle(tilt, 200);
    assert.equal(tilt.settled(), true);
    assert.equal(tilt.yaw, 0);
  });

  it("ignores touch pointers", () => {
    const target = new EventTarget();
    const tilt = createPointerTilt(target, 3, 2, { area: () => area });
    target.dispatchEvent(move(100, 50, "touch"));
    settle(tilt, 10);
    assert.equal(tilt.yaw, 0);
  });

  it("wakes the loop on a move and on a leave", () => {
    const target = new EventTarget();
    const wake = mock.fn();
    createPointerTilt(target, 3, 2, { area: () => area, wake });
    target.dispatchEvent(move(10, 10));
    target.dispatchEvent(new Event("pointerleave"));
    assert.equal(wake.mock.callCount(), 2);
  });

  it("stops listening after dispose", () => {
    const target = new EventTarget();
    const tilt = createPointerTilt(target, 3, 2, { area: () => area });
    tilt.dispose();
    target.dispatchEvent(move(100, 50));
    settle(tilt, 10);
    assert.equal(tilt.yaw, 0);
  });
});

describe("motionAllowed", () => {
  it("is true for a fine pointer with motion on", () => {
    assert.equal(
      motionAllowed({ coarse: false, paused: false, reduced: false }),
      true
    );
  });

  it("is false for a coarse pointer", () => {
    assert.equal(
      motionAllowed({ coarse: true, paused: false, reduced: false }),
      false
    );
  });

  it("is false under reduced motion", () => {
    assert.equal(
      motionAllowed({ coarse: false, paused: false, reduced: true }),
      false
    );
  });

  it("is false while the Motion switch is paused", () => {
    assert.equal(
      motionAllowed({ coarse: false, paused: true, reduced: false }),
      false
    );
  });
});

describe("loopMayRun", () => {
  it("runs only when the stage is in view, the tab is visible and motion is on", () => {
    assert.equal(
      loopMayRun({ inView: true, still: false, visible: true }),
      true
    );
  });

  it("stays off while the stage is out of view, whatever the switch does", () => {
    assert.equal(
      loopMayRun({ inView: false, still: false, visible: true }),
      false
    );
    assert.equal(
      loopMayRun({ inView: false, still: true, visible: true }),
      false
    );
  });

  it("stays off in a hidden tab", () => {
    assert.equal(
      loopMayRun({ inView: true, still: false, visible: false }),
      false
    );
  });

  it("stays off while still", () => {
    assert.equal(
      loopMayRun({ inView: true, still: true, visible: true }),
      false
    );
  });
});
