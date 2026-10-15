import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { createTooltipStore, type TooltipStore } from "./tooltip-store.ts";

const timing = { closeDelay: 100, openDelay: 200, skipDelay: 400 };

describe("createTooltipStore", () => {
  let store: TooltipStore;

  beforeEach(() => {
    mock.timers.enable({ apis: ["setTimeout"] });
    store = createTooltipStore(() => timing);
  });

  afterEach(() => {
    store.dispose();
    mock.timers.reset();
  });

  it("waits for the open delay on the first tip", () => {
    store.open("a", false, 10);
    assert.equal(store.getActive(), null);
    mock.timers.tick(199);
    assert.equal(store.getActive(), null);
    mock.timers.tick(1);
    assert.equal(store.getActive(), "a");
    assert.equal(store.getSkipped(), false);
  });

  it("opens a focused tip at once", () => {
    store.open("a", true);
    assert.equal(store.getActive(), "a");
  });

  it("opens the next tip at once while the group is warm", () => {
    store.open("a", true, 10);
    store.close("a", false);
    mock.timers.tick(100);
    assert.equal(store.getActive(), null);
    assert.equal(store.getWarm(), true);
    store.open("b", false, 80);
    assert.equal(store.getActive(), "b");
    assert.equal(store.getSkipped(), true);
    assert.equal(store.getTravel(), 1);
  });

  it("cools down after the skip delay", () => {
    store.open("a", true);
    store.close("a", true);
    assert.equal(store.getWarm(), true);
    mock.timers.tick(400);
    assert.equal(store.getWarm(), false);
    store.open("b", false);
    assert.equal(store.getActive(), null);
    mock.timers.tick(200);
    assert.equal(store.getActive(), "b");
    assert.equal(store.getSkipped(), false);
  });

  it("cancels a pending open when the pointer leaves", () => {
    store.open("a", false);
    mock.timers.tick(100);
    store.close("a", false);
    mock.timers.tick(500);
    assert.equal(store.getActive(), null);
  });

  it("keeps a tip open when the pointer comes back before the close delay", () => {
    store.open("a", true);
    store.close("a", false);
    mock.timers.tick(50);
    store.open("a", true);
    mock.timers.tick(500);
    assert.equal(store.getActive(), "a");
  });

  it("blocks a dismissed tip until the pointer leaves", () => {
    store.open("a", true);
    store.dismiss("a");
    assert.equal(store.getActive(), null);
    assert.equal(store.getWarm(), false);
    store.open("a", true);
    assert.equal(store.getActive(), null);
    store.unblock("a");
    store.open("a", true);
    assert.equal(store.getActive(), "a");
  });

  it("reports travel as -1, 0 or 1", () => {
    store.open("a", true, 100);
    assert.equal(store.getTravel(), 0);
    store.open("b", true, 40);
    assert.equal(store.getTravel(), -1);
  });

  it("notifies subscribers and stops after unsubscribe", () => {
    let hits = 0;
    const off = store.subscribe(() => {
      hits += 1;
    });
    store.open("a", true);
    assert.equal(hits, 1);
    off();
    store.close("a", true);
    assert.equal(hits, 1);
  });

  it("reset closes the tip and clears the block", () => {
    store.open("a", true);
    store.dismiss("a");
    store.open("b", true);
    store.reset();
    assert.equal(store.getActive(), null);
    store.open("a", true);
    assert.equal(store.getActive(), "a");
  });

  it("gives each store its own seat", () => {
    assert.notEqual(store.seat, createTooltipStore(() => timing).seat);
  });
});
