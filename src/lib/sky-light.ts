import { clamp01, deg, smoothstep } from "./math.ts";
import { type SkyPhase } from "./sky-clock.ts";
import {
  moonIllumination,
  moonPosition,
  sunPosition,
} from "./sky-ephemeris.ts";
import {
  diskGain,
  earthRadius,
  eyeAltitude,
  limbDip,
  worldDirection,
} from "./sky-view.ts";

export interface SkyLight {
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
const tauRay: Vec3 = [0.046, 0.108, 0.265];
const aerosol: Vec3 = [0.759, 1, 1.337];
const scaleHeight = 8000;
const horizonMass = 35.4;
const tangentSigma = 225_700;
const tintDivisor = 3.2;

const map3 = (fn: (index: 0 | 1 | 2) => number): Vec3 => [fn(0), fn(1), fn(2)];

const airmass = (height: number): number => {
  const e = Math.max(height, 0);
  return 1 / (Math.sin(e) + 0.50572 * (e / deg + 6.07995) ** -1.6364);
};

export const pathMass = (elevation: number): number => {
  const density = Math.exp(-eyeAltitude / scaleHeight);
  if (elevation >= 0) return density * airmass(elevation);
  const radius = earthRadius + eyeAltitude;
  const tangent = radius * Math.cos(elevation) - earthRadius;
  if (tangent <= 0) return 2 * horizonMass;
  const reach = radius * Math.sin(-elevation);
  const near = Math.sqrt(1 - Math.exp(-0.6366 * (reach / tangentSigma) ** 2));
  return horizonMass * Math.exp(-tangent / scaleHeight) * (1 + near);
};

const sunTint = (tau: Vec3, mass: number): Vec3 => {
  const t = map3((i) => Math.exp((-tau[i] * mass) / tintDivisor));
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

export const skyLight = (instant: number): SkyLight => {
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
  const aod = haze * (0.7 + 0.3 * daylight.dusk);
  const tau = map3((i) => tauRay[i] + aerosol[i] * aod);
  const sunMass = pathMass(sunEl);
  const moonMass = pathMass(moonEl);
  const sunShown = sunEl + sun.angularRadius * deg > -limbDip;
  const moonShown = moonEl + moon.angularRadius * deg > -limbDip;
  const tint = sunTint(tau, sunMass);
  const sunPower = 2.5 * sunStrength * (sunShown ? 1 : 0);
  const sunColor = map3((i) => tint[i] * sunPower);
  const dayK = smoothstep(-0.14, 0.22, sunEl);
  const { fraction } = lit;
  const moonUp =
    smoothstep(-limbDip - 0.01, -limbDip + 0.12, moonEl) * (1 - dayK);
  const moonPower = 0.05 * moonlight * fraction ** 1.5 * moonUp;
  const moonColor: Vec3 = [
    0.85 * moonPower,
    0.92 * moonPower,
    1.05 * moonPower,
  ];
  const flat = (above: number): number =>
    1 - 0.3 * Math.exp(-Math.max(above, 0) / (1.6 * deg));
  const sunDisk: Vec4 = sunShown
    ? [
        sun.angularRadius * deg * gain,
        6 * Math.exp(-0.1 * sunMass),
        glare * 0.5 * (1 + 0.15 * Math.min(sunMass, 12)),
        flat(sunEl + limbDip),
      ]
    : [sun.angularRadius * deg * gain, 0, 0, 1];
  const dayVisible = smoothstep(0.05, 0.25, fraction);
  const moonBright = moonShown
    ? 3.2 * (1 - 0.45 * dayK) * Math.exp(-0.1 * moonMass)
    : 0;
  const halo = (glare * 0.25 * fraction * (1 - dayK) * moonBright) / 3.2;
  return {
    daylight,
    moon: [...moonDir, moon.angularRadius * deg * gain],
    moonColor,
    moonDisk: [moonBright, halo, dayVisible, flat(moonEl + limbDip)],
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
