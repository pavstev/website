import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createFrameClock, type FrameClock } from "./frame-clock.ts";

const ticks = (clock: FrameClock, times: readonly number[]): number[] =>
  times.map((now) => clock.tick(now));

describe("createFrameClock", () => {
  it("starts at startMs and adds nothing on the first tick", () => {
    assert.deepEqual(ticks(createFrameClock(), [5000]), [0]);
    assert.deepEqual(ticks(createFrameClock(40_000), [5000]), [40_000]);
  });

  it("adds the time between ticks, at most 100 ms per tick and never backwards", () => {
    assert.deepEqual(
      ticks(createFrameClock(), [1000, 1016, 1049]),
      [0, 16, 49]
    );
    assert.deepEqual(
      ticks(createFrameClock(), [1000, 1250, 1266]),
      [0, 100, 116]
    );
    assert.deepEqual(ticks(createFrameClock(), [1000, 990]), [0, 0]);
  });

  it("skips the time between pause and the next tick", () => {
    const clock = createFrameClock();
    assert.deepEqual(ticks(clock, [1000, 1020]), [0, 20]);
    clock.pause();
    assert.deepEqual(ticks(clock, [600_000, 600_030]), [20, 50]);
  });

  it("holds its time across repeated pauses", () => {
    const clock = createFrameClock(500);
    ticks(clock, [0, 16]);
    clock.pause();
    assert.deepEqual(ticks(clock, [90_000]), [516]);
    clock.pause();
    assert.deepEqual(ticks(clock, [95_000]), [516]);
  });
});
