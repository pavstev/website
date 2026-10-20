import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { initAnchoredPopovers, popoverOrigin } from "./anchored-popovers.ts";

interface FakePanel extends EventTarget {
  dataset: Record<string, string>;
  getAnimations: () => Array<{ finished: Promise<unknown> }>;
  hidePopover: () => void;
  id: string;
  matches: (selector: string) => boolean;
  querySelector: (selector: string) => { focus: () => void };
  showPopover: () => void;
  style: { removeProperty: () => void };
}

interface FakeTrigger extends EventTarget {
  attributes: Map<string, string>;
  dataset: Record<string, string>;
  focus: () => void;
  setAttribute: (name: string, value: string) => void;
  toggleAttribute: (name: string, force: boolean) => void;
}

interface Fixture {
  clickTrigger: (detail: number, pointerType?: string) => boolean;
  dispose: () => void;
  focusInside: (inside: boolean) => void;
  focusMoves: () => number;
  panel: FakePanel;
  trigger: FakeTrigger;
  triggerFocus: () => number;
}

const toggleEvent = (type: string, open: boolean): Event =>
  Object.assign(new Event(type), { newState: open ? "open" : "closed" });

let wide = true;

let animations: Array<{ finished: Promise<unknown> }> = [];

const stopTracking = (): void => undefined;

const untracked = (): (() => void) => stopTracking;

const build = (hoverOpen: string, anchored = ""): Fixture => {
  let open = false;
  let inside = false;
  let moves = 0;
  let triggerMoves = 0;
  const panel = Object.assign(new EventTarget(), {
    dataset: { anchored },
    getAnimations: (): Array<{ finished: Promise<unknown> }> => animations,
    hidePopover: (): void => {
      panel.dispatchEvent(toggleEvent("beforetoggle", false));
      open = false;
      panel.dispatchEvent(toggleEvent("toggle", false));
    },
    id: "panel",
    matches: (selector: string): boolean =>
      selector === ":popover-open"
        ? open
        : selector === ":focus-within" && inside,
    querySelector: (): { focus: () => void } => ({
      focus: (): void => {
        moves += 1;
      },
    }),
    showPopover: (): void => {
      panel.dispatchEvent(toggleEvent("beforetoggle", true));
      open = true;
      panel.dispatchEvent(toggleEvent("toggle", true));
    },
    style: { removeProperty: (): void => undefined },
  }) satisfies FakePanel;
  const trigger = Object.assign(new EventTarget(), {
    attributes: new Map<string, string>(),
    dataset: { hoverOpen },
    focus: (): void => {
      triggerMoves += 1;
    },
    setAttribute: (name: string, value: string): void => {
      trigger.attributes.set(name, value);
    },
    toggleAttribute: (name: string, force: boolean): void => {
      if (force) trigger.attributes.set(name, "");
      else trigger.attributes.delete(name);
    },
  }) satisfies FakeTrigger;
  const root = {
    querySelector: (): FakeTrigger => trigger,
    querySelectorAll: (): FakePanel[] => [panel],
  };
  const dispose = initAnchoredPopovers(
    root as unknown as ParentNode,
    untracked
  );
  return {
    clickTrigger: (detail: number, pointerType?: string): boolean => {
      const click = Object.assign(new Event("click", { cancelable: true }), {
        detail,
        ...(pointerType !== undefined && { pointerType }),
      });
      trigger.dispatchEvent(click);
      if (!click.defaultPrevented) {
        const toggle = open ? panel.hidePopover : panel.showPopover;
        toggle();
      }
      return click.defaultPrevented;
    },
    dispose,
    focusInside: (value: boolean): void => {
      inside = value;
    },
    focusMoves: (): number => moves,
    panel,
    trigger,
    triggerFocus: (): number => triggerMoves,
  };
};

const isOpen = (fixture: Fixture): boolean =>
  fixture.panel.matches(":popover-open");

describe("initAnchoredPopovers hover cards", () => {
  beforeEach(() => {
    wide = true;
    animations = [];
    Object.assign(globalThis, {
      CSS: { escape: (value: string) => value },
      document: Object.assign(new EventTarget(), {
        activeElement: null,
        body: {},
      }),
      matchMedia: (query: string) => ({
        get matches(): boolean {
          return !query.includes("min-width") || wide;
        },
      }),
    });
    mock.timers.enable({ apis: ["setTimeout"] });
  });

  afterEach(() => {
    mock.timers.reset();
    Reflect.deleteProperty(globalThis, "CSS");
    Reflect.deleteProperty(globalThis, "document");
    Reflect.deleteProperty(globalThis, "matchMedia");
  });

  it("opens after 300 ms and closes 300 ms after the pointer leaves", () => {
    const fixture = build("pin");
    fixture.trigger.dispatchEvent(new Event("pointerenter"));
    mock.timers.tick(299);
    assert.equal(isOpen(fixture), false);
    mock.timers.tick(1);
    assert.equal(isOpen(fixture), true);
    assert.equal(fixture.trigger.attributes.get("aria-expanded"), "true");
    fixture.trigger.dispatchEvent(new Event("pointerleave"));
    mock.timers.tick(299);
    assert.equal(isOpen(fixture), true);
    mock.timers.tick(1);
    assert.equal(isOpen(fixture), false);
    assert.equal(fixture.trigger.attributes.get("aria-expanded"), "false");
    fixture.dispose();
  });

  it("stays open while the pointer moves from the word onto the card", () => {
    const fixture = build("pin");
    fixture.trigger.dispatchEvent(new Event("pointerenter"));
    mock.timers.tick(300);
    fixture.trigger.dispatchEvent(new Event("pointerleave"));
    mock.timers.tick(200);
    fixture.panel.dispatchEvent(new Event("pointerenter"));
    mock.timers.tick(1000);
    assert.equal(isOpen(fixture), true);
    fixture.dispose();
  });

  it("pins on a mouse click and unpins on a second click", () => {
    const fixture = build("pin");
    fixture.trigger.dispatchEvent(new Event("pointerenter"));
    mock.timers.tick(300);
    assert.equal(fixture.clickTrigger(1), true);
    assert.equal(fixture.focusMoves(), 0);
    fixture.trigger.dispatchEvent(new Event("pointerleave"));
    mock.timers.tick(1000);
    assert.equal(isOpen(fixture), true);
    assert.equal(fixture.clickTrigger(1), true);
    assert.equal(isOpen(fixture), false);
    fixture.dispose();
  });

  it("pins on a click whose pointer type is mouse even with detail 0", () => {
    const fixture = build("pin");
    assert.equal(fixture.clickTrigger(0, "mouse"), true);
    fixture.trigger.dispatchEvent(new Event("pointerleave"));
    mock.timers.tick(1000);
    assert.equal(isOpen(fixture), true);
    fixture.dispose();
  });

  it("returns focus to the trigger when the panel closes with focus inside", () => {
    const fixture = build("pin");
    fixture.clickTrigger(1, "");
    fixture.focusInside(true);
    fixture.panel.hidePopover();
    assert.equal(fixture.triggerFocus(), 1);
    fixture.dispose();
  });

  it("returns focus to the trigger when focus fell to the body", () => {
    const fixture = build("pin");
    fixture.clickTrigger(1, "");
    Object.assign(globalThis.document, {
      activeElement: globalThis.document.body,
    });
    fixture.panel.hidePopover();
    assert.equal(fixture.triggerFocus(), 1);
    fixture.dispose();
  });

  it("leaves focus alone when it moved out before the panel closed", () => {
    const fixture = build("pin");
    fixture.clickTrigger(1, "");
    fixture.focusInside(false);
    fixture.panel.hidePopover();
    assert.equal(fixture.triggerFocus(), 0);
    fixture.dispose();
  });

  it("treats a click with an empty pointer type as the keyboard", () => {
    const fixture = build("pin");
    assert.equal(fixture.clickTrigger(1, ""), false);
    assert.equal(fixture.focusMoves(), 1);
    fixture.dispose();
  });

  it("opens at once on a mouse click before the delay ends", () => {
    const fixture = build("pin");
    fixture.trigger.dispatchEvent(new Event("pointerenter"));
    mock.timers.tick(100);
    fixture.clickTrigger(1);
    assert.equal(isOpen(fixture), true);
    mock.timers.tick(1000);
    assert.equal(isOpen(fixture), true);
    fixture.dispose();
  });

  it("does not reopen a card that was closed while an open timer ran", () => {
    const fixture = build("pin");
    fixture.trigger.dispatchEvent(new Event("pointerenter"));
    mock.timers.tick(300);
    fixture.panel.dispatchEvent(new Event("pointerenter"));
    mock.timers.tick(100);
    fixture.panel.hidePopover();
    mock.timers.tick(1000);
    assert.equal(isOpen(fixture), false);
    fixture.dispose();
  });

  it("leaves a keyboard click to the browser", () => {
    const fixture = build("pin");
    assert.equal(fixture.clickTrigger(0), false);
    assert.equal(isOpen(fixture), true);
    assert.equal(fixture.focusMoves(), 1);
    fixture.dispose();
  });

  it("stays open on pointer leave while focus is inside the card", () => {
    const fixture = build("pin");
    fixture.trigger.dispatchEvent(new Event("pointerenter"));
    mock.timers.tick(300);
    fixture.focusInside(true);
    fixture.trigger.dispatchEvent(new Event("pointerleave"));
    mock.timers.tick(1000);
    assert.equal(isOpen(fixture), true);
    fixture.dispose();
  });

  it("leaves a card that opens as a bottom sheet to the click", () => {
    wide = false;
    const fixture = build("pin");
    fixture.trigger.dispatchEvent(new Event("pointerenter"));
    mock.timers.tick(1000);
    assert.equal(isOpen(fixture), false);
    assert.equal(fixture.clickTrigger(1), false);
    assert.equal(isOpen(fixture), true);
    fixture.trigger.dispatchEvent(new Event("pointerleave"));
    mock.timers.tick(1000);
    assert.equal(isOpen(fixture), true);
    fixture.dispose();
  });

  it("keeps hover for a popover anchored on every screen", () => {
    wide = false;
    const fixture = build("", "always");
    fixture.trigger.dispatchEvent(new Event("pointerenter"));
    mock.timers.tick(120);
    assert.equal(isOpen(fixture), true);
    fixture.trigger.dispatchEvent(new Event("pointerleave"));
    mock.timers.tick(220);
    assert.equal(isOpen(fixture), false);
    fixture.dispose();
  });

  it("keeps the quick timing and no pinning for plain hover popovers", () => {
    const fixture = build("");
    fixture.trigger.dispatchEvent(new Event("pointerenter"));
    mock.timers.tick(120);
    assert.equal(isOpen(fixture), true);
    assert.equal(fixture.clickTrigger(1), false);
    fixture.dispose();
  });
});

const settle = (): Promise<void> =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

describe("initAnchoredPopovers exit", () => {
  beforeEach(() => {
    wide = true;
    animations = [];
    Object.assign(globalThis, {
      CSS: { escape: (value: string) => value },
      document: Object.assign(new EventTarget(), {
        activeElement: null,
        body: {},
      }),
      matchMedia: () => ({ matches: true }),
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "CSS");
    Reflect.deleteProperty(globalThis, "document");
    Reflect.deleteProperty(globalThis, "matchMedia");
  });

  it("keeps the panel placed until its exit animation has finished", async () => {
    const fixture = build("pin");
    fixture.panel.showPopover();
    assert.equal("floating" in fixture.panel.dataset, true);
    const exit = Promise.withResolvers<undefined>();
    animations = [{ finished: exit.promise }];
    fixture.panel.hidePopover();
    await settle();
    assert.equal("floating" in fixture.panel.dataset, true);
    exit.resolve(undefined);
    await settle();
    assert.equal("floating" in fixture.panel.dataset, false);
    fixture.dispose();
  });

  it("keeps the placement when the panel opens again during the exit", async () => {
    const fixture = build("pin");
    fixture.panel.showPopover();
    const exit = Promise.withResolvers<undefined>();
    animations = [{ finished: exit.promise }];
    fixture.panel.hidePopover();
    fixture.panel.showPopover();
    exit.resolve(undefined);
    await settle();
    assert.equal("floating" in fixture.panel.dataset, true);
    fixture.dispose();
  });

  it("releases at once when the animation list is empty", async () => {
    const fixture = build("pin");
    fixture.panel.showPopover();
    fixture.panel.hidePopover();
    await settle();
    assert.equal("floating" in fixture.panel.dataset, false);
    fixture.dispose();
  });
});

describe("initAnchoredPopovers binding", () => {
  beforeEach(() => {
    wide = true;
    animations = [];
    Object.assign(globalThis, {
      CSS: { escape: (value: string) => value },
      document: Object.assign(new EventTarget(), {
        activeElement: null,
        body: {},
      }),
      matchMedia: () => ({ matches: true }),
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "CSS");
    Reflect.deleteProperty(globalThis, "document");
    Reflect.deleteProperty(globalThis, "matchMedia");
  });

  it("binds a panel once until the first binding is disposed", () => {
    const fixture = build("");
    const root = {
      querySelector: (): FakeTrigger => fixture.trigger,
      querySelectorAll: (): FakePanel[] => [fixture.panel],
    } as unknown as ParentNode;
    let tracked = 0;
    const counting = (): (() => void) => {
      tracked += 1;
      return stopTracking;
    };
    const second = initAnchoredPopovers(root, counting);
    fixture.panel.showPopover();
    fixture.panel.hidePopover();
    assert.equal(tracked, 0);
    second();
    fixture.dispose();
    const third = initAnchoredPopovers(root, counting);
    fixture.panel.showPopover();
    assert.equal(tracked, 1);
    fixture.panel.hidePopover();
    third();
  });
});

const outsideClick = (): Event => {
  const click = new Event("click", { cancelable: true });
  globalThis.document.dispatchEvent(click);
  return click;
};

describe("initAnchoredPopovers click guard", () => {
  beforeEach(() => {
    wide = false;
    animations = [];
    Object.assign(globalThis, {
      CSS: { escape: (value: string) => value },
      document: Object.assign(new EventTarget(), {
        activeElement: null,
        body: {},
      }),
      matchMedia: (query: string) => ({
        matches: !query.includes("min-width") || wide,
      }),
      Node: Map,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "CSS");
    Reflect.deleteProperty(globalThis, "document");
    Reflect.deleteProperty(globalThis, "matchMedia");
    Reflect.deleteProperty(globalThis, "Node");
  });

  it("swallows the click that follows a tap outside an open sheet", () => {
    const fixture = build("");
    fixture.panel.showPopover();
    globalThis.document.dispatchEvent(new Event("pointerdown"));
    assert.equal(outsideClick().defaultPrevented, true);
    assert.equal(outsideClick().defaultPrevented, false);
    fixture.dispose();
  });

  it("lets a click through when no tap started outside an open sheet", () => {
    const fixture = build("");
    fixture.panel.showPopover();
    assert.equal(outsideClick().defaultPrevented, false);
    fixture.dispose();
  });

  it("lets the tap through when the sheet is closed", () => {
    const fixture = build("");
    globalThis.document.dispatchEvent(new Event("pointerdown"));
    assert.equal(outsideClick().defaultPrevented, false);
    fixture.dispose();
  });

  it("lets the tap through when the panel floats", () => {
    wide = true;
    const fixture = build("");
    fixture.panel.showPopover();
    globalThis.document.dispatchEvent(new Event("pointerdown"));
    assert.equal(outsideClick().defaultPrevented, false);
    fixture.dispose();
  });
});

describe("popoverOrigin", () => {
  it("points at the trigger from a panel below it", () => {
    assert.equal(
      popoverOrigin("bottom", 40, { height: 120, width: 200 }),
      "40px 0px"
    );
  });

  it("points at the trigger from a panel above it", () => {
    assert.equal(
      popoverOrigin("top", 90.4, { height: 120, width: 200 }),
      "90px 120px"
    );
  });

  it("keeps the point inside the panel", () => {
    assert.equal(
      popoverOrigin("bottom", -30, { height: 120, width: 200 }),
      "0px 0px"
    );
    assert.equal(
      popoverOrigin("top", 500, { height: 120, width: 200 }),
      "200px 120px"
    );
  });
});
