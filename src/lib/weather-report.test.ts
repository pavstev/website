import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compassPoint,
  conditionOfCode,
  conditionOfState,
  formatTemperature,
  iconOf,
  reportOf,
  weatherConditions,
  weatherIconNames,
} from "./weather-report.ts";
import { type ViennaWeather, weatherStates } from "./weather.ts";

const live: ViennaWeather = {
  code: 2,
  cover: 84,
  high: 0,
  low: 13,
  mid: 83,
  rain: 0,
  showers: 0,
  snow: 0,
  temperature: 14.3,
  time: "2026-10-12T16:30",
  visibility: 44_520,
  windDirection: 342,
  windSpeed: 12.5,
};

describe("conditionOfCode", () => {
  it("maps the WMO codes Open-Meteo sends", () => {
    const cases: Array<[number, string]> = [
      [0, "clear"],
      [1, "mainlyClear"],
      [2, "partly"],
      [3, "overcast"],
      [45, "fog"],
      [48, "fog"],
      [53, "drizzle"],
      [63, "rain"],
      [81, "rain"],
      [73, "snow"],
      [86, "snow"],
      [95, "storm"],
      [99, "storm"],
      [42, "overcast"],
    ];
    for (const [code, condition] of cases) {
      assert.equal(conditionOfCode(code), condition, String(code));
    }
  });
});

describe("conditionOfState", () => {
  it("gives every sky preset a condition", () => {
    for (const state of weatherStates) {
      assert.ok(weatherConditions.includes(conditionOfState(state)));
    }
  });
});

describe("iconOf", () => {
  it("uses the sun by day and the moon by night", () => {
    assert.equal(iconOf("clear", true), "lucide:sun");
    assert.equal(iconOf("clear", false), "lucide:moon");
    assert.equal(iconOf("partly", false), "lucide:cloud-moon");
  });

  it("only returns icons in the list the badge renders", () => {
    for (const condition of weatherConditions) {
      for (const day of [true, false]) {
        assert.ok(weatherIconNames.includes(iconOf(condition, day)));
      }
    }
  });
});

describe("compassPoint", () => {
  it("rounds to the nearest of eight points", () => {
    assert.equal(compassPoint(0), "N");
    assert.equal(compassPoint(342), "N");
    assert.equal(compassPoint(337), "NW");
    assert.equal(compassPoint(90), "E");
    assert.equal(compassPoint(200), "S");
    assert.equal(compassPoint(-90), "W");
    assert.equal(compassPoint(720), "N");
  });
});

describe("formatTemperature", () => {
  it("rounds to whole degrees with a fixed space", () => {
    assert.equal(formatTemperature(14.3), "14\u{A0}°C");
    assert.equal(formatTemperature(-0.4), "0\u{A0}°C");
    assert.equal(formatTemperature(-3.6), "-4\u{A0}°C");
  });
});

describe("reportOf", () => {
  it("reports a dry live sample", () => {
    assert.deepEqual(reportOf(live), {
      condition: "partly",
      precipitation: undefined,
      temperature: "14\u{A0}°C",
      wind: { from: "N", speed: "13\u{A0}km/h" },
    });
  });

  it("adds rain and showers, and prefers snow", () => {
    assert.deepEqual(
      reportOf({ ...live, rain: 0.2, showers: 0.15 }).precipitation,
      {
        amount: "0.4\u{A0}mm",
        kind: "rain",
      }
    );
    assert.deepEqual(reportOf({ ...live, rain: 1, snow: 0.7 }).precipitation, {
      amount: "0.7\u{A0}cm",
      kind: "snow",
    });
  });

  it("leaves the temperature out when the answer has none", () => {
    const { temperature, ...older } = live;
    assert.equal(temperature, 14.3);
    assert.equal(reportOf(older).temperature, undefined);
  });
});
