import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { vienna } from "./geo.ts";
import { sunPosition } from "./sky-ephemeris.ts";
import { moonView } from "./sky-moon.ts";
import { paintScene, tableInput } from "./sky-paint.ts";
import { skyStorySteps, storyInstant, storyWeather } from "./sky-story.ts";
import { sunSpot } from "./sky-sun.ts";
import { turnDegrees, type ViewSize } from "./sky-view.ts";
import { weatherPresets } from "./weather.ts";

const phone: ViewSize = { height: 844, width: 390 };
const desktop: ViewSize = { height: 900, width: 1440 };
const views: readonly ViewSize[] = [phone, desktop];
const { clear } = weatherPresets;

const keyAltitudes: readonly number[] = [
  -5.9, 0.95, 17, 30, 21.25, -0.3, -51.3, -53.8, -52.3,
];

const sunAltitude = (chapter: number): number =>
  sunPosition(storyInstant(chapter), vienna.lat, vienna.lon).altitude;

const stepIndex = (id: (typeof skyStorySteps)[number]): number =>
  skyStorySteps.indexOf(id);

describe("skyStorySteps", () => {
  it("lists the nine chapters in order", () => {
    assert.deepEqual(
      [...skyStorySteps],
      [
        "hero",
        "sunrise",
        "morning",
        "midday",
        "weather",
        "sunset",
        "night",
        "yours",
        "outro",
      ]
    );
  });
});

describe("storyInstant", () => {
  it("never runs backwards and moves on every scroll step", () => {
    let prev = storyInstant(0);
    for (let c = 0.005; c <= 8.0001; c += 0.005) {
      const next = storyInstant(c);
      assert.ok(
        next > prev,
        `time stalls or runs back at chapter ${c.toFixed(3)}`
      );
      prev = next;
    }
  });

  it("clamps outside the story", () => {
    assert.equal(storyInstant(-2), storyInstant(0));
    assert.equal(storyInstant(12), storyInstant(8));
  });

  it("stays on the one fixed day", () => {
    const first = new Date(storyInstant(0)).toISOString();
    const last = new Date(storyInstant(8)).toISOString();
    assert.equal(first.slice(0, 10), "2026-10-24");
    assert.equal(last.slice(0, 10), "2026-10-24");
  });

  it("puts the sun at the planned height on every key", () => {
    for (const [index, altitude] of keyAltitudes.entries())
      assert.ok(
        Math.abs(sunAltitude(index) - altitude) < 0.3,
        `chapter ${String(index)}: ${sunAltitude(index).toFixed(2)} is not near ${altitude.toFixed(2)}`
      );
  });

  it("hits each key time exactly at its read spot", () => {
    const clocks = [
      "04:56",
      "05:36",
      "07:30",
      "10:38",
      "13:10",
      "15:50",
      "21:33",
      "22:40",
      "23:30",
    ];
    for (const [index, clock] of clocks.entries())
      assert.equal(
        new Date(storyInstant(index)).toISOString().slice(11, 16),
        clock
      );
  });

  it("rests near each read spot", () => {
    for (let index = 1; index < 8; index += 1) {
      const wide = storyInstant(index + 0.05) - storyInstant(index);
      const span = storyInstant(index + 1) - storyInstant(index);
      assert.ok(wide < span * 0.1, `chapter ${String(index)} does not dwell`);
    }
  });
});

describe("the sun on screen", () => {
  it("is up and in view for sunrise, morning, midday and the weather", () => {
    for (const view of views)
      for (const id of ["sunrise", "morning", "midday", "weather"] as const) {
        const instant = storyInstant(stepIndex(id));
        const spot = sunSpot(instant, view, vienna);
        assert.ok(spot, `${id} has no sun at ${String(view.width)}`);
        assert.ok(spot.x > spot.radius && spot.x < view.width - spot.radius);
        assert.ok(spot.y > spot.radius && spot.y < view.height - spot.radius);
        const scene = paintScene(instant, view, clear, vienna);
        assert.ok(
          scene.sunUp > 0.7,
          `${id} sun is dim at ${String(view.width)}`
        );
      }
  });

  it("sits on the horizon at sunset", () => {
    const altitude = sunAltitude(stepIndex("sunset"));
    assert.ok(Math.abs(altitude) < 0.5, `sunset height ${altitude.toFixed(2)}`);
    for (const view of views) {
      const spot = sunSpot(storyInstant(stepIndex("sunset")), view, vienna);
      assert.ok(spot, `no sun at sunset ${String(view.width)}`);
      assert.ok(spot.y > view.height - 0.05 * view.height);
    }
  });

  it("is down in the blue hour of the hero", () => {
    assert.ok(sunAltitude(0) < -4);
    assert.equal(sunSpot(storyInstant(0), phone, vienna), undefined);
  });
});

describe("the moon on screen", () => {
  it("is high and visible for the night and your sky", () => {
    for (const view of views)
      for (const id of ["night", "yours"] as const) {
        const instant = storyInstant(stepIndex(id));
        const moon = moonView(instant, vienna.lat, vienna.lon);
        assert.ok(moon.altitude > 40, `${id} moon is low`);
        const scene = paintScene(instant, view, clear, vienna);
        const [x, y, radius, fade] = scene.moon;
        assert.equal(fade, 1, `${id} moon hidden at ${String(view.width)}`);
        assert.ok(x > radius && x < view.width - radius);
        assert.ok(y > view.height * 0.4 && y < view.height - radius);
      }
  });

  it("is lit nearly full on the story day", () => {
    const moon = moonView(storyInstant(6), vienna.lat, vienna.lon);
    assert.ok(moon.fraction > 0.94);
  });

  it("shows from the dusk and is up but off screen at sunset", () => {
    const sunset = moonView(storyInstant(5), vienna.lat, vienna.lon);
    assert.ok(sunset.altitude > 5);
    const shown = paintScene(storyInstant(5), phone, clear, vienna).moon[3];
    assert.equal(shown, 0);
    const later = paintScene(storyInstant(5.7), phone, clear, vienna).moon[3];
    assert.equal(later, 1);
  });
});

const centers = (view: ViewSize): number[] => {
  const found: number[] = [];
  for (let c = 5; c <= 6.0001; c += 0.005)
    found.push(tableInput(storyInstant(c), view, clear, vienna).center);
  return found;
};

describe("the dusk pan", () => {
  it("turns the view in small steps from the sun to the moon", () => {
    for (const view of views) {
      const all = centers(view);
      let worst = 0;
      for (let i = 1; i < all.length; i += 1)
        worst = Math.max(
          worst,
          Math.abs(turnDegrees((all[i] ?? 0) - (all[i - 1] ?? 0)))
        );
      assert.ok(worst < 3.2, `a pan step of ${worst.toFixed(2)} degrees`);
    }
  });

  it("turns toward the moon", () => {
    const all = centers(phone);
    const first = all[0] ?? 0;
    const last = all.at(-1) ?? 0;
    assert.ok(Math.abs(turnDegrees(last - first)) > 60);
  });
});

describe("storyWeather", () => {
  it("starts clear, rains at the weather chapter and ends clear", () => {
    assert.equal(storyWeather(0).rain, 0);
    assert.equal(storyWeather(0).overcast, 0);
    assert.equal(storyWeather(stepIndex("weather")).rain, 1);
    assert.equal(storyWeather(stepIndex("sunset")).rain, 0);
    assert.equal(storyWeather(8).overcast, 0);
  });

  it("clears for the sunset and the night", () => {
    for (const c of [5, 6, 7, 8])
      assert.deepEqual(storyWeather(c), { ...weatherPresets.clear });
  });

  it("eases without a jump", () => {
    let prev = storyWeather(0);
    for (let c = 0.01; c <= 8; c += 0.01) {
      const next = storyWeather(c);
      assert.ok(Math.abs(next.overcast - prev.overcast) < 0.1);
      assert.ok(Math.abs(next.rain - prev.rain) < 0.1);
      prev = next;
    }
  });

  it("returns a fresh object and leaves the presets alone", () => {
    const first = storyWeather(4);
    first.rain = 0;
    assert.equal(storyWeather(4).rain, 1);
    assert.equal(weatherPresets.rain.rain, 1);
  });
});
