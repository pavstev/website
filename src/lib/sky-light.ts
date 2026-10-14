import { clamp01, deg, smoothstep } from "./math.ts";
import { type SkyPhase } from "./sky-clock.ts";
import {
  moonIllumination,
  moonPosition,
  sunPosition,
} from "./sky-ephemeris.ts";
import { diskGain, worldDirection } from "./sky-view.ts";
import { type SkyWeather } from "./weather.ts";

export interface SkyLight {
  ambient: Vec3;
  daylight: SkyPhase;
  moon: Vec4;
  moonColor: Vec3;
  moonDisk: Vec4;
  moonShade: Vec4;
  sun: Vec4;
  sunColor: Vec3;
  sunDisk: Vec4;
}

type Vec3 = readonly [number, number, number];
type Vec4 = readonly [number, number, number, number];

export const crawlerInstant = Date.parse("2026-01-20T23:00:00+01:00");
export const viennaLatitude = 48.2082;
export const viennaLongitude = 16.3738;

const haze = 0.21;
const sunStrength = 1;
const moonlight = 1;
const earthshine = 1;
const glare = 1;
const cirrus = 1;
const tauRay: Vec3 = [0.046, 0.108, 0.265];
const aerosol: Vec3 = [0.759, 1, 1.337];
const warm: Vec3 = [1, 0.48, 0.32];
const nightAmbient: Vec3 = [0.006, 0.008, 0.015];
const veilFloor = 0.25;
const moonVeilFloor = 0.3;
const belowHorizon = -3;

const map3 = (fn: (index: 0 | 1 | 2) => number): Vec3 => [fn(0), fn(1), fn(2)];

const airmass = (height: number): number => {
  const e = Math.max(height, 0);
  return 1 / (Math.sin(e) + 0.50572 * (e / deg + 6.07995) ** -1.6364);
};

const sunTint = (tau: Vec3, elevation: number): Vec3 => {
  const t = map3((i) =>
    Math.exp(
      -tau[i] * (airmass(elevation) / 3.2 + Math.max(-elevation, 0) * 46)
    )
  );
  const top = Math.max(t[0], t[1], t[2], 1e-4);
  return map3((i) => t[i] / top);
};

export const phaseFromSun = (altitude: number, azimuth: number): SkyPhase => {
  const up = smoothstep(-6, 5, altitude);
  const arc = clamp01(Math.sin(altitude * deg) / 0.5);
  return {
    day: up * (0.55 + 0.45 * arc),
    dusk: azimuth > 180 ? 1 : 0,
    twilight: Math.exp(-(((altitude + 0.833) / 6.5) ** 2)),
  };
};

export const skyLight = (instant: number, weather: SkyWeather): SkyLight => {
  const sun = sunPosition(instant, viennaLatitude, viennaLongitude);
  const moon = moonPosition(instant, viennaLatitude, viennaLongitude);
  const lit = moonIllumination(instant, viennaLatitude, viennaLongitude);
  const sunDir = worldDirection(sun.altitude, sun.azimuth);
  const moonDir = worldDirection(moon.altitude, moon.azimuth);
  const gain = diskGain(
    sunDir,
    moonDir,
    sun.angularRadius * deg,
    moon.angularRadius * deg
  );
  const sunEl = sun.altitude * deg;
  const moonEl = moon.altitude * deg;
  const daylight = phaseFromSun(sun.altitude, sun.azimuth);
  const ov = weather.overcast;
  const { fog } = weather;
  const aod = haze * (0.7 + 0.3 * daylight.dusk);
  const tau = map3((i) => tauRay[i] + aerosol[i] * aod);
  const tint = sunTint(tau, sunEl);
  const sunPower =
    2.5 *
    sunStrength *
    smoothstep(-0.07, 0.04, sunEl) *
    (1 - 0.9 * ov) *
    (1 - 0.75 * fog);
  const sunColor = map3((i) => tint[i] * sunPower);
  const dayK = smoothstep(-0.14, 0.22, sunEl);
  const dayAmbient: Vec3 = [
    0.26 + 0.14 * ov,
    0.33 + 0.08 * ov,
    0.46 - 0.03 * ov,
  ];
  const dayScale =
    (0.75 + 0.25 * sunStrength) *
    (1 - 0.25 * weather.rain) *
    (1 + 0.6 * weather.snow * ov);
  const { fraction } = lit;
  const moonUp = smoothstep(-0.01, 0.12, moonEl) * (1 - dayK);
  const moonPower =
    0.05 * moonlight * fraction ** 1.5 * moonUp * (1 - 0.6 * ov);
  const moonColor: Vec3 = [
    0.85 * moonPower,
    0.92 * moonPower,
    1.05 * moonPower,
  ];
  const ambient = map3(
    (i) =>
      dayAmbient[i] * dayScale * dayK +
      nightAmbient[i] * (1 - dayK) +
      warm[i] * daylight.twilight * 0.07 * (1 - ov) +
      moonColor[i] * 0.5
  );
  const flat = (altitude: number): number =>
    1 - 0.18 * Math.exp(-Math.max(altitude, 0) / 1.6);
  const cover = smoothstep(0.5, 0.95, ov);
  const sunShown = sun.altitude > belowHorizon;
  const sunDisk: Vec4 = sunShown
    ? [
        sun.angularRadius * deg * gain,
        6 * Math.exp(-0.1 * airmass(sunEl)) * (1 - (1 - veilFloor) * cover),
        glare *
          (0.35 + 1.2 * aod + 0.8 * fog) *
          (1 + 0.15 * Math.min(airmass(sunEl), 12)) *
          (1 - 0.6 * cover),
        flat(sun.altitude),
      ]
    : [sun.angularRadius * deg * gain, 0, 0, 1];
  const dayVisible = smoothstep(0.05, 0.25, fraction);
  const moonBright =
    moon.altitude > belowHorizon
      ? (3.2 * (1 - dayK) + 0.5 * dayVisible * dayK) *
        (1 - (1 - moonVeilFloor) * smoothstep(0.55, 0.95, ov)) *
        (1 - 0.5 * fog)
      : 0;
  const halo =
    (glare *
      (0.12 + 1.6 * aod + 1.2 * fog + 0.5 * weather.high * cirrus + 0.5 * ov) *
      fraction *
      (1 - dayK) *
      moonBright) /
    3.2;
  return {
    ambient,
    daylight,
    moon: [...moonDir, moon.angularRadius * deg * gain],
    moonColor,
    moonDisk: [moonBright, halo, dayVisible, flat(moon.altitude)],
    moonShade: [
      Math.cos(lit.phaseAngle * deg),
      lit.brightLimbFromZenith * deg,
      moon.parallacticAngle * deg,
      earthshine * 0.035 * (1 - fraction) ** 1.5 * (1 - dayK),
    ],
    sun: [...sunDir, sunEl],
    sunColor,
    sunDisk,
  };
};

export const instantOverride = (search: string): number | undefined => {
  const value = new URLSearchParams(search).get("at");
  if (value === null) return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : ms;
};
