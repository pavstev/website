import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { initAnchoredPopovers } from "./anchored-popovers.ts";

interface FakePanel extends EventTarget {
  dataset: Record<string, string>;
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
}

const toggleEvent = (type: string, open: boolean): Event =>
  Object.assign(new Event(type), { newState: open ? "open" : "closed" });

const build = (hoverOpen: string): Fixture => {
  let open = false;
  let inside = false;
  let moves = 0;
  const panel = Object.assign(new EventTarget(), {
    dataset: { anchored: "" },
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
  const dispose = initAnchoredPopovers(root as unknown as ParentNode);
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
  };
};

const isOpen = (fixture: Fixture): boolean =>
  fixture.panel.matches(":popover-open");

describe("initAnchoredPopovers hover cards", () => {
  beforeEach(() => {
    Object.assign(globalThis, {
      CSS: { escape: (value: string) => value },
      matchMedia: (query: string) => ({
        matches: !query.includes("min-width"),
      }),
    });
    mock.timers.enable({ apis: ["setTimeout"] });
  });

  afterEach(() => {
    mock.timers.reset();
    Reflect.deleteProperty(globalThis, "CSS");
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

  it("keeps the quick timing and no pinning for plain hover popovers", () => {
    const fixture = build("");
    fixture.trigger.dispatchEvent(new Event("pointerenter"));
    mock.timers.tick(120);
    assert.equal(isOpen(fixture), true);
    assert.equal(fixture.clickTrigger(1), false);
    fixture.dispose();
  });
});
