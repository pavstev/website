import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { type LatLon, vienna } from "./geo.ts";
import { lutCols, lutRows, type SkyTable } from "./sky-light.ts";
import { paintSkyShader } from "./sky-paint-shader.ts";
import {
  coronaSpot,
  mixScene,
  nightAim,
  nightScene,
  type PaintScene,
  paintScene,
  shotScene,
  spaceBand,
  starShare,
  tableInput,
} from "./sky-paint.ts";
import { paintPalettes } from "./sky-palette.ts";
import { anchorX, projectSight } from "./sky-view.ts";
import { hexBytes } from "./theme.ts";
import { fallbackWeather, weatherPresets } from "./weather.ts";

const laptop = {
  card: { bottom: 640, left: 520, right: 920, top: 180 },
  height: 900,
  width: 1440,
};

const near = (actual: number, expected: number, slack = 1e-6): void => {
  assert.ok(
    Math.abs(actual - expected) <= slack,
    `${String(actual)} is not ${String(expected)}`
  );
};

const allFinite = (value: unknown): boolean =>
  typeof value === "object" && value !== null
    ? Object.values(value).every((part) => allFinite(part))
    : typeof value !== "number" || Number.isFinite(value);

const stubTable: SkyTable = {
  lit: [0.9, 0.8, 0.7],
  low: [0.1, 0.2, 0.3],
  mid: [0.4, 0.5, 0.6],
  pixels: new Uint8Array(lutCols * lutRows * 4),
  shade: [0.3, 0.2, 0.1],
  sunColor: [1, 0.9, 0.8],
  top: [0.7, 0.6, 0.5],
};

const spread = (c: readonly number[]): number =>
  Math.max(...c) - Math.min(...c);

const tones = (s: PaintScene): number[] => [
  ...s.lit,
  ...s.low,
  ...s.mid,
  ...s.shade,
  ...s.top,
];

const nightUnit = (tone: "lit" | "shade"): [number, number, number] => {
  const [r, g, b] = hexBytes(paintPalettes.night[tone]);
  return [r / 255, g / 255, b / 255];
};

describe("nightAim", () => {
  it("turns to the moon only after dusk and while it is up", () => {
    assert.equal(nightAim(-1, 30), 0);
    assert.equal(nightAim(-10, 30), 1);
    assert.equal(nightAim(-10, -5), 0);
    near(nightAim(-5, 30), 0.5);
  });
});

describe("starShare", () => {
  it("lets stars in from -1 to -9 degrees", () => {
    assert.deepEqual(
      [
        starShare(10),
        starShare(-1),
        starShare(-5),
        starShare(-9),
        starShare(-20),
      ],
      [0, 0, 0.5, 1, 1]
    );
  });
});

describe("paint shaders", () => {
  it("has no skyline", () => {
    for (const name of [
      "skylineLayer",
      "cityLayer",
      "spire",
      "roofBand",
      "hillH",
      "sdBox",
      "sdSeg",
      "lineInk",
      "u_night",
    ])
      assert.ok(!paintSkyShader.includes(name), name);
  });

  it("scales the mist by the haze", () => {
    assert.ok(paintSkyShader.includes("u_haze"));
  });

  it("paints the corona and the meteor", () => {
    for (const name of [
      "u_corona",
      "u_coronaCol",
      "u_meteor",
      "u_meteorScale",
      "coronaLayer",
    ])
      assert.ok(paintSkyShader.includes(name), name);
    assert.ok(!paintSkyShader.includes("u_paint"));
  });

  it("puts the corona after the moon aura and before the clouds", () => {
    const aura = paintSkyShader.indexOf("col += moonAura(fc);");
    const corona = paintSkyShader.indexOf("col += coronaLayer(fc);");
    const clouds = paintSkyShader.indexOf("texture2D(u_clouds");
    assert.ok(aura > 0 && corona > aura && clouds > corona);
  });
});

describe("paintScene", () => {
  it("puts the noon sun right of the card with no stars", () => {
    const scene = paintScene(
      Date.parse("2026-10-19T13:00:00+02:00"),
      laptop,
      fallbackWeather,
      vienna
    );
    near(scene.sun[0], anchorX(laptop), 1e-6);
    assert.ok(scene.sun[1] > 0 && scene.sun[1] < laptop.height);
    assert.equal(scene.stars, 0);
    assert.ok(scene.sunUp > 0.99);
    assert.equal(scene.cumulus, 0.5);
    assert.equal(scene.drift, 1.6);
  });

  it("passes the cloud layers through", () => {
    const scene = paintScene(
      Date.parse("2026-10-19T13:00:00+02:00"),
      laptop,
      { ...fallbackWeather, alto: 0.4, cirrus: 0.9, cumulus: 0.2, haze: 1.6 },
      vienna
    );
    assert.equal(scene.alto, 0.4);
    assert.equal(scene.cirrus, 0.9);
    assert.equal(scene.cumulus, 0.2);
    assert.equal(scene.haze, 1.6);
  });

  it("turns to a bright full moon at night", () => {
    const scene = paintScene(
      Date.parse("2026-08-28T04:00:00+02:00"),
      laptop,
      weatherPresets.clear,
      vienna
    );
    near(scene.moon[0], anchorX(laptop), 1);
    assert.equal(scene.moon[3], 1);
    assert.ok(scene.moonGlow > 0.95);
    assert.ok(scene.earth < 0.01);
    assert.ok(scene.stars > 0.5 && scene.stars < 1);
    near(scene.moon[2], laptop.height * 0.026 * 0.93 * 1.85, 2.5);
  });

  it("draws the moon 1.85 times bigger", () => {
    const scene = paintScene(
      Date.parse("2026-11-20T16:50:00Z"),
      { height: 900, width: 1440 },
      weatherPresets.clear,
      vienna
    );
    const share = scene.moon[2] / 900;
    assert.ok(share > 0.043 && share < 0.054);
  });

  it("carries the aura and the air tint of the moon", () => {
    const scene = paintScene(
      Date.parse("2026-11-20T16:50:00Z"),
      { height: 900, width: 1440 },
      weatherPresets.clear,
      vienna
    );
    assert.equal(scene.aura, 0.55);
    assert.ok(allFinite(scene.moonTint));
    assert.ok(scene.moonTint.every((c) => c > 0 && c <= 1));
  });

  it("hides the stars and dims the sun under overcast", () => {
    const at = Date.parse("2026-10-19T13:00:00+02:00");
    const clear = paintScene(
      at,
      laptop,
      weatherPresets.clear,
      vienna,
      stubTable
    );
    const grey = paintScene(
      at,
      laptop,
      weatherPresets.overcast,
      vienna,
      stubTable
    );
    assert.equal(grey.stars, 0);
    assert.ok(grey.sunUp < 0.2);
    assert.ok(grey.glow < clear.glow);
    assert.ok(spread(grey.mid) < spread(clear.mid));
    assert.equal(clear.grey, 0);
    near(grey.grey, weatherPresets.overcast.overcast * 0.8);
  });

  it("lights the overcast and rain deck light grey by day", () => {
    const at = Date.parse("2026-10-19T12:00:00+02:00");
    const scene = (name: "overcast" | "rain"): PaintScene =>
      paintScene(at, laptop, weatherPresets[name], vienna, stubTable);
    const overcast = scene("overcast");
    const rain = scene("rain");
    for (const tone of [overcast.lit, overcast.low, overcast.shade])
      assert.ok(Math.min(...tone) > 0.42, String(tone));
    assert.ok(Math.min(...rain.shade) > 0.35, String(rain.shade));
    assert.ok(rain.lit[1] < overcast.lit[1]);
    assert.ok(rain.low[1] < overcast.low[1]);
  });

  it("keeps the dim deck below the horizon, in snow and in fog", () => {
    const dusk = Date.parse("2026-10-19T16:00:00Z");
    const noon = Date.parse("2026-10-19T12:00:00+02:00");
    const dim = { ...weatherPresets.overcast, snow: 1 };
    assert.deepEqual(
      tones(
        paintScene(dusk, laptop, weatherPresets.overcast, vienna, stubTable)
      ),
      tones(paintScene(dusk, laptop, dim, vienna, stubTable))
    );
    const snow = paintScene(
      noon,
      laptop,
      weatherPresets.snow,
      vienna,
      stubTable
    );
    const fog = paintScene(noon, laptop, weatherPresets.fog, vienna, stubTable);
    assert.ok(Math.max(...snow.mid) < 0.42, String(snow.mid));
    assert.ok(Math.max(...fog.shade) < 0.4, String(fog.shade));
  });

  it("takes the colors from the table", () => {
    const scene = paintScene(
      Date.parse("2026-10-19T13:30:00Z"),
      laptop,
      weatherPresets.clear,
      vienna,
      stubTable
    );
    assert.deepEqual(scene.low, stubTable.low);
    assert.deepEqual(scene.mid, stubTable.mid);
    assert.deepEqual(scene.top, stubTable.top);
    assert.deepEqual(scene.sunColor, stubTable.sunColor);
    assert.deepEqual(scene.lit, stubTable.lit);
    assert.deepEqual(scene.shade, stubTable.shade);
    assert.equal(scene.lutMix, 1);
    assert.equal(scene.grey, 0);
    near(scene.glow, 0.3);
  });

  it("gives the night palette for lit and shade deep in the night", () => {
    const scene = paintScene(
      Date.parse("2026-10-10T18:10:00Z"),
      laptop,
      weatherPresets.clear,
      vienna,
      stubTable
    );
    assert.equal(scene.moon[3], 0);
    assert.deepEqual(scene.lit, nightUnit("lit"));
    assert.deepEqual(scene.shade, nightUnit("shade"));
    assert.deepEqual(scene.top, stubTable.top);
  });

  it("blends lit and shade toward the night palette near -11 degrees", () => {
    const scene = paintScene(
      Date.parse("2026-10-10T17:17:00Z"),
      laptop,
      weatherPresets.clear,
      vienna,
      stubTable
    );
    assert.equal(scene.moon[3], 0);
    const between = (value: number, from: number, to: number): void => {
      assert.ok(
        value > Math.min(from, to) && value < Math.max(from, to),
        `${String(value)} is not between ${String(from)} and ${String(to)}`
      );
    };
    for (let i = 0; i < 3; i++) {
      between(
        scene.lit[i] ?? 0,
        stubTable.lit[i] ?? 0,
        nightUnit("lit")[i] ?? 0
      );
      between(
        scene.shade[i] ?? 0,
        stubTable.shade[i] ?? 0,
        nightUnit("shade")[i] ?? 0
      );
    }
  });

  it("uses the night palette without a table", () => {
    const scene = paintScene(
      Date.parse("2026-10-19T13:30:00Z"),
      laptop,
      weatherPresets.clear,
      vienna
    );
    const [r, g, b] = hexBytes(paintPalettes.night.top);
    assert.equal(scene.lutMix, 0);
    assert.deepEqual(scene.top, [r / 255, g / 255, b / 255]);
  });

  it("gives the table the same aim as the scene", () => {
    const at = Date.parse("2026-10-19T15:16:00Z");
    const input = tableInput(at, laptop, weatherPresets.clear, vienna);
    const scene = paintScene(at, laptop, weatherPresets.clear, vienna);
    const sunAt = projectSight(input.sun, input.center, laptop);
    near(sunAt.x, scene.sun[0], 1e-6);
    near(sunAt.y, scene.sun[1], 1e-6);
    near(input.sun.altitude, 6.02, 0.05);
    assert.equal(input.haze, weatherPresets.clear.haze);
    assert.equal(input.view, laptop);
  });

  it("has no moon below the horizon", () => {
    const scene = paintScene(
      Date.parse("2026-01-20T23:00:00+01:00"),
      laptop,
      fallbackWeather,
      vienna
    );
    assert.equal(scene.moon[3], 0);
    assert.equal(scene.moonGlow, 0);
  });

  it("gives finite scenes far from Vienna", () => {
    const noon = Date.parse("2026-10-19T12:00:00+02:00");
    const cases: Array<[LatLon, number]> = [
      [{ lat: -33.9, lon: 151.2 }, noon],
      [{ lat: 69.6, lon: 18.9 }, Date.parse("2026-12-21T12:00:00Z")],
      [{ lat: 69.6, lon: 18.9 }, Date.parse("2026-06-21T23:00:00Z")],
      [{ lat: 0, lon: -180 }, noon],
    ];
    for (const [place, instant] of cases)
      assert.ok(
        allFinite(paintScene(instant, laptop, fallbackWeather, place)),
        `${String(place.lat)}, ${String(place.lon)} at ${String(instant)}`
      );
  });

  it("has no corona on the home sky", () => {
    const scene = paintScene(
      Date.parse("2026-10-19T13:00:00+02:00"),
      laptop,
      fallbackWeather,
      vienna
    );
    assert.equal(scene.corona[2], 0);
  });
});

describe("nightScene", () => {
  it("draws the night look with live clouds", () => {
    const scene = nightScene(laptop, { ...fallbackWeather, cumulus: 0.6 });
    assert.equal(scene.cumulus, 0.6);
    assert.equal(scene.moon[3], 0);
    assert.equal(scene.moonGlow, 0);
    assert.equal(scene.sunUp, 0);
    assert.equal(scene.glow, 0);
    assert.equal(scene.sun[2], 0);
    assert.equal(scene.rain, 0);
    assert.equal(scene.snow, 0);
    assert.equal(scene.fog, 0);
    assert.equal(scene.lutMix, 0);
    assert.equal(scene.corona[2], 1);
    assert.ok(scene.corona[0] < 0);
    assert.ok(scene.corona[1] > laptop.height);
    const spot = coronaSpot(laptop);
    assert.deepEqual(scene.light, [spot.x, spot.y]);
    assert.equal(scene.stars, 1 - fallbackWeather.overcast);
    assert.ok(allFinite(scene));
  });
});

describe("coronaSpot", () => {
  it("sits above the top left corner", () => {
    assert.deepEqual(coronaSpot(laptop), {
      x: -0.08 * laptop.width,
      y: 1.12 * laptop.height,
    });
  });
});

describe("shotScene", () => {
  const home = paintScene(
    Date.parse("2026-08-28T04:00:00+02:00"),
    laptop,
    weatherPresets.clear,
    vienna
  );
  const night = nightScene(laptop, weatherPresets.clear);
  const spot = coronaSpot(laptop);
  const pose = {
    corona: { x: 300, y: 700 },
    disk: 0.6,
    sun: { x: 200, y: 500 },
  };

  it("fades the moon by one minus the mix and keeps its place", () => {
    assert.equal(home.moon[3], 1);
    const half = shotScene(home, night, 0.5, pose);
    assert.equal(half.moon[3], 0.5);
    assert.deepEqual(half.moon.slice(0, 3), home.moon.slice(0, 3));
    assert.deepEqual(half.moonLight, home.moonLight);
    assert.equal(shotScene(home, night, 1, pose).moon[3], 0);
    assert.equal(shotScene(home, night, 0, pose).moon[3], 1);
  });

  it("puts the corona at the pose with the mix as strength", () => {
    assert.deepEqual(
      shotScene(home, night, 0.25, pose).corona,
      [300, 700, 0.25]
    );
    const end = shotScene(home, night, 1, {
      ...pose,
      corona: spot,
    });
    assert.deepEqual(end.corona, [spot.x, spot.y, 1]);
  });

  it("moves the sun to the pose and scales its light by the disk", () => {
    const sunny = paintScene(
      Date.parse("2026-10-19T13:00:00+02:00"),
      laptop,
      weatherPresets.clear,
      vienna
    );
    const scene = shotScene(sunny, night, 0.5, pose);
    assert.deepEqual(scene.sun, [200, 500, sunny.sun[2]]);
    near(scene.sunUp, sunny.sunUp * 0.6);
    const none = shotScene(sunny, night, 0.5, {
      ...pose,
      disk: 0,
      sun: undefined,
    });
    assert.equal(none.sunUp, 0);
    assert.ok(allFinite(none));
  });
});

describe("mixScene", () => {
  const home = paintScene(
    Date.parse("2026-10-19T13:00:00+02:00"),
    laptop,
    weatherPresets.clear,
    vienna,
    stubTable
  );
  const night = nightScene(laptop, weatherPresets.overcast);

  it("mixes scenes end to end", () => {
    assert.deepEqual(mixScene(home, night, 0), home);
    assert.deepEqual(mixScene(home, night, 1), night);
    near(mixScene(home, night, 0.5).stars, (home.stars + night.stars) / 2);
  });

  it("mixes every number and color in between", () => {
    const half = mixScene(home, night, 0.5);
    near(half.lutMix, (home.lutMix + night.lutMix) / 2);
    near(half.corona[2], 0.5);
    near(half.corona[0], (home.corona[0] + night.corona[0]) / 2);
    near(half.top[1], (home.top[1] + night.top[1]) / 2);
    near(half.moon[2], (home.moon[2] + night.moon[2]) / 2);
    assert.ok(allFinite(half));
  });
});

describe("space band", () => {
  it("takes the top 24% of the screen, the same on every size", () => {
    assert.equal(spaceBand, 0.24);
    assert.ok(paintSkyShader.includes("smoothstep(1.0 - u_band"));
  });
});
