import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  fallbackWeather,
  nightWeather,
  parseReport,
  type SkyWeather,
  skyWeather,
  weatherGoal,
  weatherNameOf,
  weatherOverride,
  weatherPresets,
  type WeatherWord,
  weatherWord,
  windDrift,
} from "./weather.ts";

describe("weatherNameOf", () => {
  it("maps a weather code to the closest preset", () => {
    const cases: Array<[number, string]> = [
      [0, "clear"],
      [2, "partly"],
      [3, "overcast"],
      [45, "fog"],
      [53, "rain"],
      [63, "rain"],
      [73, "snow"],
      [95, "rain"],
    ];
    for (const [code, name] of cases) assert.equal(weatherNameOf(code), name);
  });
});

describe("weatherWord", () => {
  it("names the weather", () => {
    const cases: Array<[number, WeatherWord]> = [
      [0, "clear"],
      [1, "clear"],
      [2, "partly"],
      [3, "cloudy"],
      [45, "fog"],
      [48, "fog"],
      [53, "drizzle"],
      [63, "rain"],
      [81, "rain"],
      [73, "snow"],
      [86, "snow"],
      [96, "storm"],
      [42, "cloudy"],
    ];
    for (const [code, word] of cases) assert.equal(weatherWord(code), word);
  });
});

const body = (current: Record<string, unknown> = {}): unknown => ({
  current: {
    cloud_cover: 100,
    cloud_cover_high: 100,
    cloud_cover_low: 0,
    cloud_cover_mid: 0,
    interval: 900,
    precipitation: 0,
    relative_humidity_2m: 66,
    time: "2026-10-19T19:15",
    visibility: 24_140,
    weather_code: 3,
    wind_direction_10m: 290,
    wind_speed_10m: 9.4,
    ...current,
  },
  timezone: "Europe/Vienna",
});

const sky = (current: Record<string, unknown> = {}): SkyWeather => {
  const report = parseReport(body(current));
  assert.ok(report);
  return skyWeather(report);
};

const near = (actual: number, expected: number): void =>
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${String(actual)} is not ${String(expected)}`
  );

describe("skyWeather layers", () => {
  it("paints an all-high sky as a veil, not a deck", () => {
    const w = sky();
    assert.deepEqual([w.overcast, w.cirrus, w.cumulus, w.alto], [0, 1, 0, 0]);
  });

  it("adds the deck when low plus mid pass 85%", () =>
    assert.equal(
      sky({ cloud_cover_low: 60, cloud_cover_mid: 30 }).overcast,
      0.92
    ));

  it("compares the raw percentages, so 55 plus 30 does not close the deck", () => {
    assert.equal(sky({ cloud_cover_low: 55, cloud_cover_mid: 30 }).overcast, 0);
    assert.equal(
      sky({ cloud_cover_low: 55, cloud_cover_mid: 31 }).overcast,
      0.92
    );
  });

  it("falls back to total cover without layers", () => {
    const w = sky({
      cloud_cover: 70,
      cloud_cover_high: null,
      cloud_cover_low: null,
      cloud_cover_mid: null,
    });
    assert.deepEqual([w.cumulus, w.alto, w.cirrus], [0.7, 0, 0]);
  });

  it("clamps covers", () => {
    assert.equal(sky({ cloud_cover_low: 120 }).cumulus, 1);
    assert.equal(sky({ cloud_cover_low: -5 }).cumulus, 0);
  });

  it("sees fog in codes and low visibility", () => {
    assert.equal(sky({ weather_code: 45 }).fog, 1);
    assert.equal(sky({ visibility: 800 }).fog, 1);
    assert.equal(sky({ visibility: 1000 }).fog, 0);
  });

  it("maps haze", () => {
    const cases: Array<[null | number, null | number, number]> = [
      [30_000, 50, 1],
      [50_000, 50, 0.8],
      [50_000, 80, 1.6],
      [11_000, 50, 1.75],
      [2000, 50, 2.5],
      [500, 50, 2.5],
      [30_000, 82.5, 1.75],
      [30_000, 95, 2.5],
      [null, null, 1],
    ];
    for (const [visibility, humidity, haze] of cases) {
      near(sky({ relative_humidity_2m: humidity, visibility }).haze, haze);
    }
  });

  it("maps rain strength", () => {
    const cases: Array<[number, null | number, number]> = [
      [3, 0, 0],
      [3, 0.1, 0.3],
      [3, 0.55, 0.65],
      [3, 1, 1],
      [3, 4, 1],
      [51, 0, 0.3],
      [61, 0, 0.6],
      [95, 0, 1],
      [71, 2, 0],
      [3, null, 0],
    ];
    for (const [code, precipitation, rain] of cases) {
      near(sky({ precipitation, weather_code: code }).rain, rain);
    }
  });

  it("closes the deck for rain, snow and fog", () => {
    assert.equal(sky({ cloud_cover_high: 0, weather_code: 61 }).overcast, 0.88);
    assert.equal(sky({ cloud_cover_high: 0, weather_code: 73 }).overcast, 0.8);
    assert.equal(sky({ cloud_cover_high: 0, weather_code: 73 }).snow, 1);
    assert.equal(sky({ cloud_cover_high: 0, weather_code: 48 }).overcast, 0.25);
  });
});

describe("parseReport", () => {
  it("reads the live answer", () => {
    assert.deepEqual(parseReport(body()), {
      at: "2026-10-19T19:15",
      code: 3,
      cover: 100,
      coverHigh: 100,
      coverLow: 0,
      coverMid: 0,
      humidity: 66,
      precipitation: 0,
      visibility: 24_140,
      windFrom: 290,
      windKmh: 9.4,
      zone: "Europe/Vienna",
    });
  });

  it("keeps missing optional fields as undefined and rain as 0", () => {
    const report = parseReport(
      body({
        cloud_cover_low: undefined,
        precipitation: null,
        relative_humidity_2m: null,
        visibility: null,
      })
    );
    assert.ok(report);
    assert.equal(report.coverLow, undefined);
    assert.equal(report.visibility, undefined);
    assert.equal(report.humidity, undefined);
    assert.equal(report.precipitation, 0);
  });

  it("rejects bodies without the core fields", () => {
    for (const bad of [
      "<html>",
      null,
      {},
      { current: {} },
      body({ weather_code: null }),
      body({ time: 5 }),
      body({ wind_speed_10m: null }),
    ]) {
      assert.equal(parseReport(bad), undefined);
    }
  });
});

describe("windDrift", () => {
  it("gives 1.6x for an average breeze", () => {
    assert.equal(windDrift(14, undefined, 180), 1.6);
  });

  it("clamps calm and storm winds", () => {
    near(windDrift(0, undefined, 0), 0.64);
    assert.equal(windDrift(200, undefined, 0), 4);
  });

  it("moves clouds with the wind across the view", () => {
    assert.equal(windDrift(14, 90, 180), 1.6);
    assert.equal(windDrift(14, 270, 180), -1.6);
    assert.equal(windDrift(14, 200, 180), -1.6);
    assert.equal(windDrift(14, 0, 90), 1.6);
  });
});

describe("weather presets", () => {
  it("fills every preset", () => {
    for (const preset of Object.values(weatherPresets)) {
      assert.equal(Object.keys(preset).length, 10);
      for (const [key, value] of Object.entries(preset)) {
        if (key === "windFrom") assert.equal(value, undefined);
        else assert.ok(Number.isFinite(value), key);
      }
    }
    assert.equal(weatherPresets.fog.haze, 2.5);
    assert.equal(weatherOverride("?weather=fog"), weatherPresets.fog);
  });

  it("reads ?weather= presets for tests", () => {
    assert.equal(weatherOverride("?weather=rain"), weatherPresets.rain);
    assert.equal(weatherOverride("?weather=storm"), undefined);
    assert.equal(weatherOverride(""), undefined);
    assert.equal(fallbackWeather, weatherPresets.partly);
  });

  it("gives the night pages one fixed calm look", () => {
    const fixed = weatherPresets.rain;
    const reported = weatherPresets.fog;
    assert.equal(nightWeather, weatherPresets.partly);
    assert.equal(weatherGoal(false, fixed, reported), nightWeather);
    assert.equal(weatherGoal(false, undefined, undefined), nightWeather);
    assert.equal(weatherGoal(true, fixed, reported), fixed);
    assert.equal(weatherGoal(true, undefined, reported), reported);
    assert.equal(weatherGoal(true, undefined, undefined), fallbackWeather);
  });
});
