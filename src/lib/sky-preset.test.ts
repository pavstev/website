import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { phaseFromName } from "./sky-clock.ts";
import {
  forgetSkyPreset,
  latestSkyPreset,
  presetLook,
  readSkyPreset,
  setSkyPreset,
  skyPresetEvent,
  startingSkyPreset,
} from "./sky-preset.ts";
import { weatherPresets } from "./weather.ts";

const presetEvent = (detail: unknown): CustomEvent =>
  new CustomEvent(skyPresetEvent, { detail });

describe("readSkyPreset", () => {
  it("accepts a known weather and phase", () => {
    assert.deepEqual(
      readSkyPreset(presetEvent({ phase: "dusk", weather: "storm" })),
      { phase: "dusk", weather: "storm" }
    );
  });

  it("rejects an unknown weather", () => {
    assert.equal(readSkyPreset(presetEvent({ weather: "hail" })), undefined);
    assert.equal(
      readSkyPreset(presetEvent({ phase: "dusk", weather: "hail" })),
      undefined
    );
  });

  it("rejects an unknown phase", () => {
    assert.equal(
      readSkyPreset(presetEvent({ phase: "noon", weather: "clear" })),
      undefined
    );
  });

  it("returns null for a null detail", () => {
    assert.equal(readSkyPreset(presetEvent(null)), null);
  });

  it("ignores events without a detail", () => {
    assert.equal(readSkyPreset(new Event(skyPresetEvent)), undefined);
  });
});

const windowTarget = new EventTarget();
const originalDispatch = Object.getOwnPropertyDescriptor(
  globalThis,
  "dispatchEvent"
);

beforeEach(() => {
  Object.defineProperty(globalThis, "dispatchEvent", {
    configurable: true,
    value: windowTarget.dispatchEvent.bind(windowTarget),
    writable: true,
  });
});

afterEach(() => {
  forgetSkyPreset();
  if (originalDispatch) {
    Object.defineProperty(globalThis, "dispatchEvent", originalDispatch);
    return;
  }
  Reflect.deleteProperty(globalThis, "dispatchEvent");
});

describe("setSkyPreset", () => {
  it("dispatches the preset on the window and remembers it", () => {
    const seen: unknown[] = [];
    const listen = (event: Event): void => {
      seen.push(readSkyPreset(event));
    };
    windowTarget.addEventListener(skyPresetEvent, listen);
    setSkyPreset({ phase: "night", weather: "clear" });
    assert.deepEqual(latestSkyPreset(), { phase: "night", weather: "clear" });
    setSkyPreset(null);
    windowTarget.removeEventListener(skyPresetEvent, listen);
    assert.deepEqual(seen, [{ phase: "night", weather: "clear" }, null]);
    assert.equal(latestSkyPreset(), null);
  });
});

describe("startingSkyPreset", () => {
  it("never hands a remembered preset to the home sky", () => {
    setSkyPreset({ phase: "dusk", weather: "storm" });
    assert.equal(startingSkyPreset("home", false), null);
    assert.equal(startingSkyPreset("post", false), null);
  });

  it("hands the remembered preset to the index sky", () => {
    setSkyPreset({ phase: "dusk", weather: "storm" });
    assert.deepEqual(startingSkyPreset("index", false), {
      phase: "dusk",
      weather: "storm",
    });
  });

  it("gives crawlers no preset", () => {
    setSkyPreset({ phase: "dusk", weather: "storm" });
    assert.equal(startingSkyPreset("index", true), null);
  });

  it("forgets the preset without dispatching", () => {
    const seen: Event[] = [];
    const listen = (event: Event): void => {
      seen.push(event);
    };
    setSkyPreset({ phase: "dusk", weather: "storm" });
    windowTarget.addEventListener(skyPresetEvent, listen);
    forgetSkyPreset();
    windowTarget.removeEventListener(skyPresetEvent, listen);
    assert.equal(latestSkyPreset(), null);
    assert.equal(startingSkyPreset("index", false), null);
    assert.equal(seen.length, 0);
  });
});

describe("presetLook", () => {
  it("maps a preset to the weather preset and the named phase", () => {
    const look = presetLook({ phase: "dusk", weather: "storm" });
    assert.deepEqual(look.weather, weatherPresets.storm);
    assert.deepEqual(look.daylight, phaseFromName("dusk"));
    look.weather.cover = 0;
    assert.equal(weatherPresets.storm.cover, 1);
  });
});
