import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clampStep,
  clampStop,
  hourLabelMarks,
  hourMarks,
  hourTicks,
  keyValue,
  plainKey,
  pointerValue,
  rangeShare,
  skyRanges,
  snapStop,
  stepCount,
  stopBlend,
  timeKeyStep,
  timePageStep,
  weatherLabelMarks,
  weatherMax,
  weatherSteps,
  weatherStops,
  weatherTicks,
} from "./sky-range.ts";
import { weatherPresets } from "./weather.ts";

describe("range config", () => {
  it("cuts the day into minutes with 5 minute keys and hour pages", () => {
    assert.equal(stepCount, 1440);
    assert.equal(timeKeyStep, 5);
    assert.equal(timePageStep, 60);
    assert.deepEqual(hourMarks, [0, 6, 12, 18, 24]);
  });

  it("has one icon per weather stop and every stop is a preset", () => {
    assert.equal(weatherMax, 5);
    for (const name of weatherStops) {
      assert.ok(Object.hasOwn(weatherPresets, name), name);
      assert.match(skyRanges.weather.icons[name], /^lucide:/);
    }
    assert.equal(
      Object.keys(skyRanges.weather.icons).length,
      weatherStops.length
    );
  });

  it("puts a tick on every hour and makes every sixth one major", () => {
    assert.equal(hourTicks.length, 25);
    assert.deepEqual(hourTicks[0], { major: true, value: 0 });
    assert.deepEqual(hourTicks[1], { major: false, value: 60 });
    assert.deepEqual(hourTicks[6], { major: true, value: 360 });
    assert.deepEqual(hourTicks.at(-1), { major: true, value: stepCount });
    assert.equal(hourTicks.filter((tick) => tick.major).length, 5);
  });

  it("places the hour labels on their steps", () => {
    assert.deepEqual(hourLabelMarks, [
      { mark: 0, value: 0 },
      { mark: 6, value: 360 },
      { mark: 12, value: 720 },
      { mark: 18, value: 1080 },
      { mark: 24, value: 1440 },
    ]);
  });

  it("puts a major tick on every weather stop and four minor ticks between", () => {
    assert.equal(weatherSteps, 500);
    assert.equal(weatherTicks.length, 26);
    assert.deepEqual(
      weatherTicks.filter((tick) => tick.major).map((tick) => tick.value),
      [0, 100, 200, 300, 400, 500]
    );
    assert.deepEqual(
      weatherTicks.slice(0, 6).map((tick) => tick.value),
      [0, 20, 40, 60, 80, 100]
    );
    assert.deepEqual(weatherTicks[1], { major: false, value: 20 });
    assert.deepEqual(weatherTicks.at(-1), { major: true, value: 500 });
    assert.equal(weatherTicks.filter((tick) => !tick.major).length, 20);
  });

  it("puts one label on every weather stop", () => {
    assert.equal(weatherLabelMarks.length, 6);
    assert.deepEqual(weatherLabelMarks[3], { mark: "fog", value: 300 });
  });

  it("puts minor weather ticks on the snap points", () => {
    const reach = Math.round(
      skyRanges.weather.snap * skyRanges.weather.stepsPerStop
    );
    for (const tick of weatherTicks) {
      assert.equal(tick.value % reach, 0);
    }
  });
});

describe("snapping", () => {
  it("rounds and clamps steps and stops", () => {
    assert.equal(clampStep(57.6), 58);
    assert.equal(clampStep(-4), 0);
    assert.equal(clampStep(1600), 1440);
    assert.equal(clampStop(2.4), 2.4);
    assert.equal(clampStop(2.456), 2.46);
    assert.equal(clampStop(9), 5);
    assert.equal(clampStop(-1), 0);
  });

  it("snaps a weather stop within the magnet and keeps blends between", () => {
    assert.equal(skyRanges.weather.snap, 0.2);
    assert.equal(snapStop(2.09), 2);
    assert.equal(snapStop(1.9), 2);
    assert.equal(snapStop(2.1), 2);
    assert.equal(snapStop(2.11), 2.11);
    assert.equal(snapStop(2.5), 2.5);
    assert.equal(snapStop(4.95), 5);
    assert.equal(snapStop(-3), 0);
  });

  it("names the two neighbor stops of a blend", () => {
    assert.deepEqual(stopBlend(0), { from: "clear", share: 0, to: "partly" });
    assert.deepEqual(stopBlend(1.25), {
      from: "partly",
      share: 0.25,
      to: "overcast",
    });
    assert.deepEqual(stopBlend(5), { from: "rain", share: 1, to: "snow" });
  });

  it("leaves keys with Alt, Ctrl or Meta to the browser", () => {
    const none = { altKey: false, ctrlKey: false, metaKey: false };
    assert.equal(plainKey(none), true);
    assert.equal(plainKey({ ...none, altKey: true }), false);
    assert.equal(plainKey({ ...none, ctrlKey: true }), false);
    assert.equal(plainKey({ ...none, metaKey: true }), false);
  });

  it("moves by key to the next grid line", () => {
    assert.equal(keyValue("ArrowRight", 0, 1440, 5, 60), 5);
    assert.equal(keyValue("ArrowRight", 3, 1440, 5, 60), 5);
    assert.equal(keyValue("ArrowLeft", 7, 1440, 5, 60), 5);
    assert.equal(keyValue("ArrowDown", 5, 1440, 5, 60), 0);
    assert.equal(keyValue("PageUp", 61, 1440, 5, 60), 120);
    assert.equal(keyValue("PageDown", 61, 1440, 5, 60), 60);
    assert.equal(keyValue("End", 61, 1440, 5, 60), 1440);
    assert.equal(keyValue("Home", 61, 1440, 5, 60), 0);
    assert.equal(keyValue("ArrowRight", 1440, 1440, 5, 60), 1440);
    assert.equal(keyValue("ArrowRight", 125, 500, 100, 100), 200);
    assert.equal(keyValue("ArrowLeft", 125, 500, 100, 100), 100);
    assert.equal(keyValue("Tab", 125, 500, 100, 100), undefined);
  });

  it("maps a pointer to the nearest value on the rail", () => {
    assert.equal(pointerValue(100, 100, 200, 96), 0);
    assert.equal(pointerValue(200, 100, 200, 96), 48);
    assert.equal(pointerValue(300, 100, 200, 96), 96);
    assert.equal(pointerValue(201, 100, 200, 96), 48);
    assert.equal(pointerValue(203, 100, 200, 96), 49);
    assert.equal(pointerValue(40, 100, 200, 5), 0);
    assert.equal(pointerValue(900, 100, 200, 5), 5);
    assert.equal(pointerValue(219, 100, 200, 5), 3);
  });

  it("ignores a rail with no width", () => {
    assert.equal(pointerValue(10, 0, 0, 96), undefined);
    assert.equal(pointerValue(10, 0, -5, 96), undefined);
  });
});

describe("value to place", () => {
  it("gives the share of the rail", () => {
    assert.equal(rangeShare(0, 96), 0);
    assert.equal(rangeShare(48, 96), 0.5);
    assert.equal(rangeShare(96, 96), 1);
    assert.equal(rangeShare(120, 96), 1);
    assert.equal(rangeShare(3, 0), 0);
  });
});
