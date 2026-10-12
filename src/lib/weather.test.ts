import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  fallbackSky,
  parseViennaWeather,
  readSkyWeather,
  skyFromWeather,
  type ViennaWeather,
  weatherOverride,
  weatherPresets,
} from "./weather.ts";

const close = (actual: number, expected: number, within: number): void => {
  assert.ok(
    Math.abs(actual - expected) <= within,
    `${String(actual)} is not within ${String(within)} of ${String(expected)}`
  );
};

const live: ViennaWeather = {
  code: 2,
  cover: 84,
  high: 0,
  low: 13,
  mid: 83,
  rain: 0,
  showers: 0,
  snow: 0,
  time: "2026-10-12T16:30",
  visibility: 44_520,
  windDirection: 342,
  windSpeed: 12.5,
};

const withWeather = (patch: Partial<ViennaWeather>): ViennaWeather => ({
  ...live,
  ...patch,
});

describe("weatherPresets", () => {
  it("has one preset per weather state", () => {
    assert.deepEqual(
      Object.keys(weatherPresets).toSorted((a, b) => a.localeCompare(b)),
      ["clear", "fog", "overcast", "partly", "rain", "snow", "storm"]
    );
  });

  it("drifts left and slants rain left in every preset", () => {
    for (const preset of Object.values(weatherPresets)) {
      assert.equal(preset.drift, 1);
      assert.equal(preset.slant, -0.12);
    }
  });

  it("makes storms rain hard", () => {
    assert.equal(weatherPresets.storm.storm, 1);
    assert.equal(weatherPresets.storm.rain, 0.9);
  });
});

describe("fallbackSky", () => {
  it("matches the sky before weather", () => {
    assert.deepEqual(fallbackSky, {
      cover: 0.6,
      drift: 1,
      fog: 0,
      high: 0.5,
      overcast: 0,
      rain: 0,
      slant: 0,
      snow: 0,
      storm: 0,
    });
  });
});

describe("skyFromWeather", () => {
  it("maps a live Vienna sample", () => {
    const sky = skyFromWeather(live);
    close(sky.cover, 0.7055, 1e-9);
    close(sky.high, 0.1, 1e-9);
    close(sky.drift, -0.5, 1e-9);
    close(sky.slant, 0.064, 0.001);
    close(sky.overcast, 0.64, 0.01);
    assert.equal(sky.fog, 0);
    assert.equal(sky.rain, 0);
    assert.equal(sky.snow, 0);
    assert.equal(sky.storm, 0);
  });

  it("keeps a thin cloud floor and maps high cloud", () => {
    const sky = skyFromWeather(
      withWeather({ cover: 0, high: 44, low: 0, mid: 0 })
    );
    assert.equal(sky.cover, 0.12);
    close(sky.high, 0.496, 1e-9);
    assert.equal(sky.overcast, 0);
  });

  it("moves clouds right in a west wind", () => {
    const sky = skyFromWeather(
      withWeather({ windDirection: 270, windSpeed: 30 })
    );
    close(sky.drift, -2, 1e-9);
    close(sky.slant, 0.5, 1e-9);
  });

  it("moves clouds left in an east wind", () => {
    const sky = skyFromWeather(
      withWeather({ windDirection: 90, windSpeed: 15 })
    );
    close(sky.drift, 1, 1e-9);
    close(sky.slant, -0.25, 1e-9);
  });

  it("drifts slowly in calm air", () => {
    const sky = skyFromWeather(withWeather({ windSpeed: 0.5 }));
    assert.equal(sky.drift, 0.5);
  });

  it("drifts slowly in a north wind", () => {
    const sky = skyFromWeather(
      withWeather({ windDirection: 0, windSpeed: 40 })
    );
    assert.equal(sky.drift, 0.5);
    close(sky.slant, 0, 1e-9);
  });

  it("forces fog for fog codes", () => {
    assert.equal(skyFromWeather(withWeather({ code: 45 })).fog, 0.85);
    assert.equal(skyFromWeather(withWeather({ code: 48 })).fog, 0.85);
  });

  it("thickens fog as visibility drops", () => {
    close(skyFromWeather(withWeather({ visibility: 500 })).fog, 0.85, 1e-9);
    const hazy = skyFromWeather(withWeather({ visibility: 5500 })).fog;
    assert.ok(hazy > 0.3 && hazy < 0.55);
  });

  it("maps drizzle, rain and showers", () => {
    assert.equal(skyFromWeather(withWeather({ code: 51 })).rain, 0.25);
    assert.equal(skyFromWeather(withWeather({ code: 63 })).rain, 0.7);
    assert.equal(skyFromWeather(withWeather({ code: 82 })).rain, 1);
  });

  it("darkens the sky when it rains or snows", () => {
    assert.equal(skyFromWeather(withWeather({ code: 51 })).overcast, 0.85);
    assert.equal(skyFromWeather(withWeather({ code: 71 })).overcast, 0.85);
  });

  it("raises rain from measured millimetres", () => {
    assert.equal(
      skyFromWeather(withWeather({ rain: 2, showers: 1 })).rain,
      0.75
    );
    assert.equal(skyFromWeather(withWeather({ code: 61, rain: 8 })).rain, 1);
  });

  it("maps snow codes and measured snow", () => {
    assert.equal(skyFromWeather(withWeather({ code: 73 })).snow, 0.7);
    assert.equal(skyFromWeather(withWeather({ snow: 1.2 })).snow, 0.6);
    assert.equal(skyFromWeather(withWeather({ code: 71, snow: 5 })).snow, 1);
  });

  it("marks thunderstorms", () => {
    for (const code of [95, 96, 99]) {
      const sky = skyFromWeather(withWeather({ code }));
      assert.equal(sky.storm, 1);
      assert.ok(sky.rain >= 0.8);
    }

    assert.equal(skyFromWeather(withWeather({ code: 65 })).storm, 0);
  });
});

describe("parseViennaWeather", () => {
  it("accepts a full sample", () => {
    assert.deepEqual(parseViennaWeather({ ...live, extra: 1 }), live);
  });

  it("rejects bad input", () => {
    assert.equal(parseViennaWeather(null), undefined);
    assert.equal(parseViennaWeather("weather"), undefined);
    assert.equal(parseViennaWeather([live]), undefined);
    assert.equal(parseViennaWeather({ weather: live }), undefined);
    assert.equal(parseViennaWeather({ ...live, time: "" }), undefined);
    assert.equal(parseViennaWeather({ ...live, time: 5 }), undefined);
    assert.equal(parseViennaWeather({ ...live, cover: "84" }), undefined);
    assert.equal(parseViennaWeather({ ...live, visibility: NaN }), undefined);
    assert.equal(
      parseViennaWeather({ ...live, windSpeed: Infinity }),
      undefined
    );
    const { snow, ...missing } = live;
    assert.equal(snow, 0);
    assert.equal(parseViennaWeather(missing), undefined);
  });
});

describe("weatherOverride", () => {
  it("returns the preset for a known state", () => {
    assert.deepEqual(weatherOverride("?weather=rain"), weatherPresets.rain);
    assert.deepEqual(
      weatherOverride("?motion=off&weather=storm"),
      weatherPresets.storm
    );
  });

  it("returns a copy", () => {
    assert.notEqual(weatherOverride("?weather=fog"), weatherPresets.fog);
  });

  it("ignores unknown or missing states", () => {
    assert.equal(weatherOverride(""), undefined);
    assert.equal(weatherOverride("?weather="), undefined);
    assert.equal(weatherOverride("?weather=hail"), undefined);
    assert.equal(weatherOverride("?weather=toString"), undefined);
    assert.equal(weatherOverride("?other=rain"), undefined);
  });
});

describe("readSkyWeather", () => {
  it("maps the weather inside a /weather answer", () => {
    assert.deepEqual(readSkyWeather({ weather: live }), skyFromWeather(live));
  });

  it("gives nothing for a failed or broken answer", () => {
    assert.equal(readSkyWeather({ weather: null }), undefined);
    assert.equal(readSkyWeather("weather"), undefined);
    assert.equal(readSkyWeather({ weather: { code: 2 } }), undefined);
  });
});
