import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createListeners } from "./listeners.ts";

describe("createListeners", () => {
  it("adds listeners and removes them all on dispose", () => {
    const target = new EventTarget();
    const listeners = createListeners();
    let hits = 0;
    listeners.on(target, "ping", () => {
      hits += 1;
    });
    listeners.on(target, "pong", () => {
      hits += 10;
    });
    target.dispatchEvent(new Event("ping"));
    target.dispatchEvent(new Event("pong"));
    assert.equal(hits, 11);
    listeners.dispose();
    target.dispatchEvent(new Event("ping"));
    target.dispatchEvent(new Event("pong"));
    assert.equal(hits, 11);
  });

  it("passes the options to addEventListener", () => {
    const seen: unknown[] = [];
    const target = {
      addEventListener: (
        _type: string,
        _listener: unknown,
        options: unknown
      ) => {
        seen.push(options);
      },
      removeEventListener: () => undefined,
    } as unknown as EventTarget;
    createListeners({ passive: true }).on(target, "x", () => undefined);
    createListeners().on(target, "x", () => undefined);
    assert.deepEqual(seen, [{ passive: true }, undefined]);
  });

  it("runs extra disposers in order on dispose", () => {
    const listeners = createListeners();
    const order: string[] = [];
    listeners.add(() => {
      order.push("a");
    });
    listeners.add(() => {
      order.push("b");
    });
    listeners.dispose();
    assert.deepEqual(order, ["a", "b"]);
  });
});
