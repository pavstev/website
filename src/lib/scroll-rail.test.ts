import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import { bindRail, type RailHandle } from "./scroll-rail.ts";

const ids = ["hero", "c01", "c03"] as const;

interface FakeTick extends EventTarget {
  attributes: Map<string, string>;
  dataset: Record<string, string>;
  removeAttribute: (name: string) => void;
  setAttribute: (name: string, value: string) => void;
}

interface Fixture {
  handle: RailHandle;
  scrolls: Array<ReturnType<typeof mock.fn>>;
  ticks: FakeTick[];
}

const buildTick = (id: string): FakeTick => {
  const attributes = new Map<string, string>();
  return Object.assign(new EventTarget(), {
    attributes,
    dataset: { tick: id },
    removeAttribute: (name: string): void => {
      attributes.delete(name);
    },
    setAttribute: (name: string, value: string): void => {
      attributes.set(name, value);
    },
  });
};

const build = (still: boolean, textHeight = 200): Fixture => {
  Object.assign(globalThis, { innerHeight: 800 });
  const ticks = ids.map((id) => buildTick(id));
  const scrolls = ids.map(() => mock.fn());
  const steps = ids.map((id, index) => ({
    dataset: { step: id },
    querySelector: (): { offsetHeight: number } => ({
      offsetHeight: textHeight,
    }),
    scrollIntoView: scrolls[index],
  }));
  const rail = { querySelectorAll: (): FakeTick[] => ticks };
  const handle = bindRail(
    rail as unknown as HTMLElement,
    steps as unknown as HTMLElement[],
    () => still,
    { bodySelector: ".story-body" }
  );
  return { handle, scrolls, ticks };
};

const marks = (ticks: FakeTick[]): Array<string | undefined> =>
  ticks.map((tick) => tick.attributes.get("aria-current"));

describe("bindRail", () => {
  it("marks the matching tick as the current step and no other", () => {
    const { handle, ticks } = build(false);
    handle.setCurrent("c03");
    assert.deepEqual(marks(ticks), [undefined, undefined, "step"]);
  });

  it("moves the mark when the current step changes", () => {
    const { handle, ticks } = build(false);
    handle.setCurrent("c03");
    handle.setCurrent("hero");
    assert.deepEqual(marks(ticks), ["step", undefined, undefined]);
  });

  it("marks nothing for a step without a tick", () => {
    const { handle, ticks } = build(false);
    handle.setCurrent("c03");
    handle.setCurrent("outro");
    assert.deepEqual(marks(ticks), [undefined, undefined, undefined]);
  });

  it("scrolls the matching step to its read spot smoothly on a click", () => {
    const { scrolls, ticks } = build(false);
    ticks[2]?.dispatchEvent(new Event("click"));
    assert.equal(scrolls[2]?.mock.callCount(), 1);
    assert.deepEqual(scrolls[2]?.mock.calls[0]?.arguments, [
      { behavior: "smooth", block: "end" },
    ]);
    assert.equal(scrolls[0]?.mock.callCount(), 0);
    assert.equal(scrolls[1]?.mock.callCount(), 0);
  });

  it("jumps without animation when motion is still", () => {
    const { scrolls, ticks } = build(true);
    ticks[1]?.dispatchEvent(new Event("click"));
    assert.deepEqual(scrolls[1]?.mock.calls[0]?.arguments, [
      { behavior: "auto", block: "end" },
    ]);
  });

  it("scrolls to the top of a step whose text is taller than the screen", () => {
    const { scrolls, ticks } = build(false, 700);
    ticks[1]?.dispatchEvent(new Event("click"));
    assert.deepEqual(scrolls[1]?.mock.calls[0]?.arguments, [
      { behavior: "smooth", block: "start" },
    ]);
  });

  it("measures the text box named by the body selector", () => {
    const asked: string[] = [];
    const tick = buildTick("hero");
    const scroll = mock.fn();
    const step = {
      dataset: { step: "hero" },
      querySelector: (selector: string): { offsetHeight: number } => {
        asked.push(selector);
        return { offsetHeight: 100 };
      },
      scrollIntoView: scroll,
    };
    bindRail(
      { querySelectorAll: (): FakeTick[] => [tick] } as unknown as HTMLElement,
      [step] as unknown as HTMLElement[],
      () => false,
      { bodySelector: ".sky-step-body" }
    );
    tick.dispatchEvent(new Event("click"));
    assert.deepEqual(asked, [".sky-step-body"]);
  });

  it("never stops above the step top when the step starts there", () => {
    const tick = buildTick("c01");
    const scrollTo = mock.fn();
    Object.assign(globalThis, {
      document: { documentElement: {} },
      getComputedStyle: (element: object): Record<string, string> =>
        "dataset" in element
          ? { scrollMarginBlockEnd: "-68px" }
          : { scrollPaddingBlockEnd: "16px" },
      innerHeight: 800,
      scrollTo,
      scrollY: 0,
    });
    const step = {
      dataset: { step: "c01" },
      getBoundingClientRect: (): { height: number; top: number } => ({
        height: 800,
        top: 800,
      }),
      querySelector: (): { offsetHeight: number } => ({ offsetHeight: 160 }),
      scrollIntoView: mock.fn(),
    };
    bindRail(
      { querySelectorAll: (): FakeTick[] => [tick] } as unknown as HTMLElement,
      [step] as unknown as HTMLElement[],
      () => false,
      { bodySelector: ".story-body", notBeforeTop: true }
    );
    tick.dispatchEvent(new Event("click"));
    assert.deepEqual(scrollTo.mock.calls[0]?.arguments, [
      { behavior: "smooth", top: 800 },
    ]);
  });

  it("stops listening after dispose", () => {
    const { handle, scrolls, ticks } = build(false);
    handle.dispose();
    ticks[0]?.dispatchEvent(new Event("click"));
    assert.equal(scrolls[0]?.mock.callCount(), 0);
  });
});
