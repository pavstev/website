import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { minePlan, moveTab, skyTabs, startTab } from "./sky-tabs.ts";

describe("skyTabs", () => {
  it("lists Stevan's, Mine and Custom in order", () => {
    assert.deepEqual(skyTabs, ["stevan", "mine", "custom"]);
  });
});

describe("startTab", () => {
  it("opens Custom while a time or a weather is chosen", () => {
    assert.equal(startTab({ time: 600, weather: undefined }, false), "custom");
    assert.equal(startTab({ time: undefined, weather: 2 }, true), "custom");
    assert.equal(startTab({ time: 0, weather: 0 }, false), "custom");
  });

  it("opens Mine for a visitor place and Stevan's otherwise", () => {
    assert.equal(
      startTab({ time: undefined, weather: undefined }, true),
      "mine"
    );
    assert.equal(
      startTab({ time: undefined, weather: undefined }, false),
      "stevan"
    );
  });
});

describe("moveTab", () => {
  it("moves with the arrows and wraps at both ends", () => {
    assert.equal(moveTab("ArrowRight", "stevan"), "mine");
    assert.equal(moveTab("ArrowRight", "mine"), "custom");
    assert.equal(moveTab("ArrowRight", "custom"), "stevan");
    assert.equal(moveTab("ArrowLeft", "stevan"), "custom");
    assert.equal(moveTab("ArrowLeft", "custom"), "mine");
  });

  it("jumps with Home and End", () => {
    assert.equal(moveTab("Home", "custom"), "stevan");
    assert.equal(moveTab("End", "stevan"), "custom");
  });

  it("ignores other keys", () => {
    assert.equal(moveTab("Enter", "stevan"), undefined);
    assert.equal(moveTab("ArrowDown", "stevan"), undefined);
    assert.equal(moveTab("a", "mine"), undefined);
  });
});

describe("minePlan", () => {
  it("keeps a visitor place that is already on", () => {
    assert.equal(minePlan(true, false), "keep");
    assert.equal(minePlan(true, true), "keep");
  });

  it("brings back the place chosen earlier in the visit", () => {
    assert.equal(minePlan(false, true), "restore");
  });

  it("asks for the rough city when there is no place yet", () => {
    assert.equal(minePlan(false, false), "ask");
  });
});
