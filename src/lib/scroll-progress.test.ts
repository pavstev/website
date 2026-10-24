import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { progressWriter } from "./scroll-progress.ts";

const build = (): { calls: string[][]; root: ParentNode } => {
  const calls: string[][] = [];
  const bar = {
    style: {
      setProperty: (name: string, value: string): void => {
        calls.push([name, value]);
      },
    },
  };
  const root = { querySelector: (): typeof bar => bar };
  return { calls, root: root as unknown as ParentNode };
};

describe("progressWriter", () => {
  it("writes nothing when the browser has a scroll timeline", () => {
    const { calls, root } = build();
    progressWriter(root, true)(0.5);
    assert.deepEqual(calls, []);
  });

  it("writes a rounded value and skips a repeat", () => {
    const { calls, root } = build();
    const write = progressWriter(root, false);
    write(0.12345);
    write(0.1234);
    write(0.5);
    assert.deepEqual(calls, [
      ["--story-progress", "0.123"],
      ["--story-progress", "0.5"],
    ]);
  });

  it("clamps the value to the range 0 to 1", () => {
    const { calls, root } = build();
    const write = progressWriter(root, false);
    write(2);
    write(-1);
    assert.deepEqual(calls, [
      ["--story-progress", "1"],
      ["--story-progress", "0"],
    ]);
  });
});
