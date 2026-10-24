import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clockLabel,
  forcedWeather,
  hourLabel,
  liveWeather,
  liveWeatherEvent,
  minutesToStep,
  previewEvent,
  previewState,
  resetPreview,
  resolveInstant,
  setLiveWeather,
  setPreviewTime,
  setPreviewWeather,
  shownTime,
  shownWeather,
  stepToMinutes,
  weatherAtStop,
  weatherStop,
} from "./sky-preview.ts";
import { hourMarks, weatherStops } from "./sky-range.ts";
import { instantOverride } from "./sky-sun.ts";
import { mixWeather, weatherNameOverride, weatherPresets } from "./weather.ts";

const vienna = "Europe/Vienna";
const noon = Date.parse("2026-10-20T12:00:00+02:00");

describe("time steps", () => {
  it("maps slider steps to minutes and back, one minute a step", () => {
    assert.equal(stepToMinutes(0), 0);
    assert.equal(stepToMinutes(871), 871);
    assert.equal(stepToMinutes(1440), 1440);
    assert.equal(stepToMinutes(2000), 1440);
    assert.equal(stepToMinutes(-3), 0);
    assert.equal(minutesToStep(871), 871);
    assert.equal(minutesToStep(871.4), 871);
    assert.equal(minutesToStep(1440), 1440);
  });

  it("labels the clock", () => {
    assert.equal(clockLabel(0), "00:00");
    assert.equal(clockLabel(870), "14:30");
    assert.equal(clockLabel(1440), "24:00");
  });
});

describe("resolveInstant", () => {
  it("uses the base when nothing is previewed", () => {
    assert.equal(resolveInstant(undefined, undefined, noon, vienna), noon);
    assert.equal(resolveInstant(undefined, 5, noon, vienna), 5);
  });

  it("puts a previewed time on the day of the base, in the place zone", () => {
    for (const [minutes, expected] of [
      [780, "2026-10-20T13:00:00+02:00"],
      [1380, "2026-10-20T23:00:00+02:00"],
      [0, "2026-10-20T00:00:00+02:00"],
      [1440, "2026-10-21T00:00:00+02:00"],
    ] as const) {
      assert.equal(
        resolveInstant(minutes, undefined, noon, vienna),
        Date.parse(expected),
        String(minutes)
      );
    }
  });

  it("starts from ?at= and moves the time on its day", () => {
    const pinned = Date.parse("2026-03-01T09:00:00+01:00");
    assert.equal(resolveInstant(undefined, pinned, noon, vienna), pinned);
    assert.equal(
      resolveInstant(840, pinned, noon, vienna),
      Date.parse("2026-03-01T14:00:00+01:00")
    );
  });

  it("follows the zone offset on the day the clocks change", () => {
    const base = Date.parse("2026-10-25T12:00:00+01:00");
    for (const [minutes, zone, expected] of [
      [180, vienna, "2026-10-25T03:00:00+01:00"],
      [60, vienna, "2026-10-25T01:00:00+02:00"],
      [780, "America/New_York", "2026-10-25T13:00:00-04:00"],
    ] as const) {
      assert.equal(
        resolveInstant(minutes, undefined, base, zone),
        Date.parse(expected),
        `${String(minutes)} in ${zone}`
      );
    }
  });
});

describe("shownTime", () => {
  it("shows now for no preview", () => {
    assert.deepEqual(shownTime(undefined, undefined, noon, vienna), {
      live: true,
      minutes: 720,
    });
  });

  it("shows the chosen time or the ?at= start", () => {
    assert.deepEqual(shownTime(870, undefined, noon, vienna), {
      live: false,
      minutes: 870,
    });
    const pinned = Date.parse("2026-03-01T09:15:00+01:00");
    assert.deepEqual(shownTime(undefined, pinned, noon, vienna), {
      live: false,
      minutes: 555,
    });
  });
});

describe("weather stops", () => {
  it("lists the six presets in range order", () => {
    assert.deepEqual(weatherStops, [
      "clear",
      "partly",
      "overcast",
      "fog",
      "rain",
      "snow",
    ]);
    assert.equal(weatherStop("fog"), 3);
    assert.equal(weatherAtStop(4), weatherPresets.rain);
    assert.equal(weatherAtStop(99), weatherPresets.snow);
    assert.equal(weatherAtStop(-1), weatherPresets.clear);
  });

  it("blends the two neighbor presets between stops", () => {
    const half = weatherAtStop(1.5);
    assert.deepEqual(
      half,
      mixWeather(weatherPresets.partly, weatherPresets.overcast, 0.5)
    );
    assert.equal(
      half.overcast,
      (weatherPresets.partly.overcast + weatherPresets.overcast.overcast) / 2
    );
    assert.equal(weatherAtStop(3.25).rain, 0.25);
  });

  it("shows the chosen weather, the ?weather= start or the live sky", () => {
    assert.deepEqual(shownWeather(undefined, undefined, undefined), {
      live: true,
      stop: 1,
    });
    assert.deepEqual(shownWeather(undefined, undefined, "rain"), {
      live: true,
      stop: 4,
    });
    assert.deepEqual(shownWeather(undefined, "fog", "rain"), {
      live: false,
      stop: 3,
    });
    assert.deepEqual(shownWeather(5, "fog", "rain"), {
      live: false,
      stop: 5,
    });
    assert.deepEqual(shownWeather(2.5, undefined, "clear"), {
      live: false,
      stop: 2.5,
    });
  });

  it("forces a preset or a blend only when one is chosen", () => {
    assert.equal(forcedWeather(4, undefined), weatherPresets.rain);
    assert.equal(forcedWeather(undefined, "fog"), weatherPresets.fog);
    assert.equal(forcedWeather(0, "fog"), weatherPresets.clear);
    assert.equal(forcedWeather(undefined, undefined), undefined);
    assert.equal(forcedWeather(4.5, undefined)?.snow, 0.5);
  });
});

describe("hour marks", () => {
  it("labels the ruler every six hours", () => {
    assert.deepEqual(
      hourMarks.map((hour) => hourLabel(hour)),
      ["00", "06", "12", "18", "24"]
    );
  });
});

describe("live weather", () => {
  it("tells listeners only when the live sky changes", () => {
    const target = new EventTarget();
    let heard = 0;
    target.addEventListener(liveWeatherEvent, () => {
      heard += 1;
    });
    setLiveWeather("overcast", target);
    setLiveWeather("overcast", target);
    assert.equal(liveWeather(), "overcast");
    assert.equal(heard, 1);
  });

  it("forgets the live sky when the place changes", () => {
    const target = new EventTarget();
    setLiveWeather("rain", target);
    setLiveWeather(undefined, target);
    assert.equal(liveWeather(), undefined);
  });
});

describe("preview store", () => {
  it("keeps the state and tells listeners", () => {
    const target = new EventTarget();
    let heard = 0;
    target.addEventListener(previewEvent, () => {
      heard += 1;
    });
    setPreviewTime(840, target);
    setPreviewWeather(4, target);
    assert.deepEqual(previewState(), { time: 840, weather: 4 });
    assert.equal(heard, 2);
    resetPreview(target);
    assert.deepEqual(previewState(), { time: undefined, weather: undefined });
    assert.equal(heard, 3);
  });
});

const listen = (target: EventTarget): unknown[] => {
  const heard: unknown[] = [];
  target.addEventListener(previewEvent, (event) => {
    heard.push(event instanceof CustomEvent ? event.detail : undefined);
  });
  return heard;
};

describe("knob changes", () => {
  it("keeps the weather when the time moves and the time when the weather moves", () => {
    const target = new EventTarget();
    resetPreview(target);
    setPreviewWeather(3, target);
    setPreviewTime(stepToMinutes(450), target);
    assert.deepEqual(previewState(), { time: 450, weather: 3 });
    setPreviewWeather(4.4, target);
    assert.deepEqual(previewState(), { time: 450, weather: 4.4 });
  });

  it("sends the new state as the event detail", () => {
    const target = new EventTarget();
    resetPreview(target);
    const heard = listen(target);
    setPreviewTime(600, target);
    setPreviewWeather(4, target);
    assert.deepEqual(heard, [
      { time: 600, weather: undefined },
      { time: 600, weather: 4 },
    ]);
  });

  it("starts live and keeps a chosen time over ?at=", () => {
    const target = new EventTarget();
    resetPreview(target);
    const pinned = instantOverride("?at=2026-03-01T09:00:00%2B01:00");
    assert.deepEqual(shownTime(previewState().time, undefined, noon, vienna), {
      live: true,
      minutes: 720,
    });
    setPreviewTime(840, target);
    assert.deepEqual(shownTime(previewState().time, pinned, noon, vienna), {
      live: false,
      minutes: 840,
    });
  });

  it("starts the time slider at ?at= in the place zone", () => {
    const pinned = instantOverride("?at=2026-03-01T09:15:00%2B01:00");
    assert.deepEqual(shownTime(undefined, pinned, noon, vienna), {
      live: false,
      minutes: 555,
    });
    assert.equal(minutesToStep(555), 555);
    assert.deepEqual(shownTime(undefined, pinned, noon, "Asia/Tokyo"), {
      live: false,
      minutes: 1035,
    });
    assert.equal(instantOverride("?at=soon"), undefined);
  });

  it("starts at ?weather= and lets a chosen stop win over it", () => {
    const target = new EventTarget();
    resetPreview(target);
    const fromUrl = weatherNameOverride("?weather=fog");
    assert.equal(fromUrl, "fog");
    assert.deepEqual(shownWeather(previewState().weather, fromUrl, "rain"), {
      live: false,
      stop: 3,
    });
    setPreviewWeather(0, target);
    assert.equal(
      forcedWeather(previewState().weather, fromUrl),
      weatherPresets.clear
    );
    assert.equal(weatherNameOverride("?weather=hail"), undefined);
  });

  it("follows the live sky until a stop is chosen", () => {
    const target = new EventTarget();
    resetPreview(target);
    setLiveWeather("overcast", target);
    assert.deepEqual(
      shownWeather(previewState().weather, undefined, liveWeather()),
      {
        live: true,
        stop: 2,
      }
    );
    setLiveWeather("snow", target);
    assert.deepEqual(
      shownWeather(previewState().weather, undefined, liveWeather()),
      {
        live: true,
        stop: 5,
      }
    );
    setPreviewWeather(weatherStop("partly"), target);
    setLiveWeather("rain", target);
    assert.deepEqual(
      shownWeather(previewState().weather, undefined, liveWeather()),
      {
        live: false,
        stop: 1,
      }
    );
    setLiveWeather(undefined, target);
  });

  it("round trips every slider step to minutes and back", () => {
    for (let step = 0; step <= 1440; step += 1) {
      assert.equal(minutesToStep(stepToMinutes(step)), step);
    }
    for (const [stop, name] of weatherStops.entries()) {
      assert.equal(weatherStop(name), stop);
      assert.equal(weatherAtStop(stop), weatherPresets[name]);
    }
  });
});
