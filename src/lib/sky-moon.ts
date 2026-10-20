import { deg } from "./math.ts";
import {
  centuries,
  cosD,
  nutation,
  refraction,
  siderealDeg,
  sinD,
  sunEquatorial,
  toEquatorial,
  toHorizontal,
  wrap360,
} from "./sky-ephemeris.ts";

export interface MoonView {
  altitude: number;
  angularRadius: number;
  azimuth: number;
  brightLimb: number;
  distanceKm: number;
  fraction: number;
  parallactic: number;
  phase: number;
  phaseAngle: number;
  pole: number;
  trueAltitude: number;
}

export interface SkyPoint {
  altitude: number;
  azimuth: number;
}

type LatitudeTerm = readonly [number, number, number, number, number];

type Term = readonly [number, number, number, number, number, number];

const earthRadiusKm = 6378.14;
const flattening = 0.99664719;
const moonRadiusKm = 1737.4;
const lunarTilt = 1.54242;
const microDegrees = 1_000_000;
const airOpacity: readonly [number, number, number] = [0.11, 0.18, 0.36];

const longitudeTerms: readonly Term[] = [
  [0, 0, 1, 0, 6_288_774, -20_905_355],
  [2, 0, -1, 0, 1_274_027, -3_699_111],
  [2, 0, 0, 0, 658_314, -2_955_968],
  [0, 0, 2, 0, 213_618, -569_925],
  [0, 1, 0, 0, -185_116, 48_888],
  [0, 0, 0, 2, -114_332, -3149],
  [2, 0, -2, 0, 58_793, 246_158],
  [2, -1, -1, 0, 57_066, -152_138],
  [2, 0, 1, 0, 53_322, -170_733],
  [2, -1, 0, 0, 45_758, -204_586],
  [0, 1, -1, 0, -40_923, -129_620],
  [1, 0, 0, 0, -34_720, 108_743],
  [0, 1, 1, 0, -30_383, 104_755],
  [2, 0, 0, -2, 15_327, 10_321],
  [0, 0, 1, 2, -12_528, 0],
  [0, 0, 1, -2, 10_980, 79_661],
  [4, 0, -1, 0, 10_675, -34_782],
  [0, 0, 3, 0, 10_034, -23_210],
  [4, 0, -2, 0, 8548, -21_636],
  [2, 1, -1, 0, -7888, 24_208],
  [2, 1, 0, 0, -6766, 30_824],
  [1, 0, -1, 0, -5163, -8379],
  [1, 1, 0, 0, 4987, -16_675],
  [2, -1, 1, 0, 4036, -12_831],
  [2, 0, 2, 0, 3994, -10_445],
  [4, 0, 0, 0, 3861, -11_650],
  [2, 0, -3, 0, 3665, 14_403],
  [0, 1, -2, 0, -2689, -7003],
  [2, 0, -1, 2, -2602, 0],
  [2, -1, -2, 0, 2390, 10_056],
  [1, 0, 1, 0, -2348, 6322],
  [2, -2, 0, 0, 2236, -9884],
  [0, 1, 2, 0, -2120, 5751],
  [0, 2, 0, 0, -2069, 0],
  [2, -2, -1, 0, 2048, -4950],
  [2, 0, 1, -2, -1773, 4130],
  [2, 0, 0, 2, -1595, 0],
  [4, -1, -1, 0, 1215, -3958],
  [0, 0, 2, 2, -1110, 0],
];

const latitudeTerms: readonly LatitudeTerm[] = [
  [0, 0, 0, 1, 5_128_122],
  [0, 0, 1, 1, 280_602],
  [0, 0, 1, -1, 277_693],
  [2, 0, 0, -1, 173_237],
  [2, 0, -1, 1, 55_413],
  [2, 0, -1, -1, 46_271],
  [2, 0, 0, 1, 32_573],
  [0, 0, 2, 1, 17_198],
  [2, 0, 1, -1, 9266],
  [0, 0, 2, -1, 8822],
  [2, -1, 0, -1, 8216],
  [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200],
  [2, 1, 0, -1, -3359],
  [2, -1, -1, 1, 2463],
  [2, -1, 0, 1, 2211],
  [2, -1, -1, -1, 2065],
  [0, 1, -1, -1, -1870],
  [4, 0, -1, -1, 1828],
  [0, 1, 0, 1, -1794],
  [0, 0, 0, 3, -1749],
  [0, 1, -1, 1, -1565],
  [1, 0, 0, 1, -1491],
  [0, 1, 1, 1, -1475],
  [0, 1, 1, -1, -1410],
  [0, 1, 0, -1, -1344],
  [1, 0, 0, -1, -1335],
  [0, 0, 3, 1, 1107],
];

interface MoonEcliptic {
  distanceKm: number;
  latitude: number;
  longitude: number;
  node: number;
}

const poly = (t: number, terms: readonly number[]): number =>
  terms.reduce((sum, value, power) => sum + value * t ** power, 0);

const moonEcliptic = (t: number): MoonEcliptic => {
  const meanLongitude = poly(t, [
    218.3164477,
    481_267.88123421,
    -0.0015786,
    1 / 538_841,
    -1 / 65_194_000,
  ]);
  const elongation = poly(t, [
    297.8501921,
    445_267.1114034,
    -0.0018819,
    1 / 545_868,
    -1 / 113_065_000,
  ]);
  const sunAnomaly = poly(t, [
    357.5291092,
    35_999.0502909,
    -0.0001536,
    1 / 24_490_000,
  ]);
  const moonAnomaly = poly(t, [
    134.9633964,
    477_198.8675055,
    0.0087414,
    1 / 69_699,
    -1 / 14_712_000,
  ]);
  const argument = poly(t, [
    93.272095,
    483_202.0175233,
    -0.0036539,
    -1 / 3_526_000,
    1 / 863_310_000,
  ]);
  const a1 = 119.75 + 131.849 * t;
  const a2 = 53.09 + 479_264.29 * t;
  const a3 = 313.45 + 481_266.484 * t;
  const eccentricity = 1 - 0.002516 * t - 0.0000074 * t * t;
  const scale = (m: number): number => eccentricity ** Math.abs(m);
  const angle = (d: number, m: number, mp: number, f: number): number =>
    d * elongation + m * sunAnomaly + mp * moonAnomaly + f * argument;
  let sumL = 0;
  let sumR = 0;
  for (const [d, m, mp, f, l, r] of longitudeTerms) {
    const at = angle(d, m, mp, f);
    sumL += l * scale(m) * sinD(at);
    sumR += r * scale(m) * cosD(at);
  }
  let sumB = 0;
  for (const [d, m, mp, f, b] of latitudeTerms) {
    sumB += b * scale(m) * sinD(angle(d, m, mp, f));
  }
  sumL +=
    3958 * sinD(a1) + 1962 * sinD(meanLongitude - argument) + 318 * sinD(a2);
  sumB +=
    -2235 * sinD(meanLongitude) +
    382 * sinD(a3) +
    175 * sinD(a1 - argument) +
    175 * sinD(a1 + argument) +
    127 * sinD(meanLongitude - moonAnomaly) -
    115 * sinD(meanLongitude + moonAnomaly);
  return {
    distanceKm: 385_000.56 + sumR / 1000,
    latitude: sumB / microDegrees,
    longitude: wrap360(meanLongitude + sumL / microDegrees),
    node: wrap360(125.0445479 - 1934.1362891 * t),
  };
};

const observerFactors = (
  latitude: number,
  heightKm: number
): { cosPart: number; sinPart: number } => {
  const u = Math.atan(flattening * Math.tan(latitude * deg));
  const lift = heightKm / earthRadiusKm;
  return {
    cosPart: Math.cos(u) + lift * cosD(latitude),
    sinPart: flattening * Math.sin(u) + lift * sinD(latitude),
  };
};

const positionAngle = (
  ra: number,
  dec: number,
  towardRa: number,
  towardDec: number
): number =>
  wrap360(
    Math.atan2(
      cosD(towardDec) * sinD(towardRa - ra),
      sinD(towardDec) * cosD(dec) -
        cosD(towardDec) * sinD(dec) * cosD(towardRa - ra)
    ) / deg
  );

const parallacticAngle = (
  hourAngle: number,
  dec: number,
  latitude: number
): number =>
  Math.atan2(
    sinD(hourAngle),
    Math.tan(latitude * deg) * cosD(dec) - sinD(dec) * cosD(hourAngle)
  ) / deg;

export const screenAngle = (position: number, parallactic: number): number =>
  ((((parallactic - position) % 360) + 540) % 360) - 180;

export const skyBearing = (from: SkyPoint, to: SkyPoint): number => {
  const dz = (to.azimuth - from.azimuth) * deg;
  const a1 = from.altitude * deg;
  const a2 = to.altitude * deg;
  return (
    Math.atan2(
      Math.sin(dz) * Math.cos(a2),
      Math.cos(a1) * Math.sin(a2) - Math.sin(a1) * Math.cos(a2) * Math.cos(dz)
    ) / deg
  );
};

export const moonView = (
  instant: number,
  latitude: number,
  longitude: number,
  heightKm = 0.2
): MoonView => {
  const t = centuries(instant);
  const moon = moonEcliptic(t);
  const nut = nutation(t);
  const apparent = moon.longitude + nut.longitude;
  const geo = toEquatorial(apparent, moon.latitude, nut.trueObliquity);
  const sidereal = siderealDeg(instant, longitude);
  const site = observerFactors(latitude, heightKm);
  const x =
    moon.distanceKm * cosD(geo.dec) * cosD(geo.ra) -
    earthRadiusKm * site.cosPart * cosD(sidereal);
  const y =
    moon.distanceKm * cosD(geo.dec) * sinD(geo.ra) -
    earthRadiusKm * site.cosPart * sinD(sidereal);
  const z = moon.distanceKm * sinD(geo.dec) - earthRadiusKm * site.sinPart;
  const distanceKm = Math.hypot(x, y, z);
  const ra = wrap360(Math.atan2(y, x) / deg);
  const dec = Math.asin(z / distanceKm) / deg;
  const place = toHorizontal(ra, dec, sidereal, latitude);
  const sun = sunEquatorial(instant);
  const elongation = Math.acos(
    sinD(sun.dec) * sinD(dec) + cosD(sun.dec) * cosD(dec) * cosD(sun.ra - ra)
  );
  const phaseAngle =
    Math.atan2(
      sun.distanceKm * Math.sin(elongation),
      distanceKm - sun.distanceKm * Math.cos(elongation)
    ) / deg;
  const waxing = wrap360(apparent - sun.longitude) < 180;
  const turn = phaseAngle / 360;
  const pole = toEquatorial(moon.node + 90, 90 - lunarTilt, nut.trueObliquity);
  return {
    altitude: place.altitude + refraction(place.altitude),
    angularRadius: Math.asin(moonRadiusKm / distanceKm) / deg,
    azimuth: place.azimuth,
    brightLimb: positionAngle(ra, dec, sun.ra, sun.dec),
    distanceKm,
    fraction: (1 + cosD(phaseAngle)) / 2,
    parallactic: parallacticAngle(place.hourAngle, dec, latitude),
    phase: waxing ? 0.5 - turn : 0.5 + turn,
    phaseAngle,
    pole: positionAngle(ra, dec, pole.ra, pole.dec),
    trueAltitude: place.altitude,
  };
};

export const airTint = (
  altitude: number
): readonly [number, number, number] => {
  const h = Math.max(altitude, -0.5);
  const mass = 1 / (Math.sin(h * deg) + 0.15 * Math.pow(h + 3.885, -1.253));
  const through = (k: number): number => Math.exp(-k * (mass - 1));
  const r = through(airOpacity[0]);
  const g = through(airOpacity[1]);
  const b = through(airOpacity[2]);
  const peak = Math.max(r, g, b);
  return [r / peak, g / peak, b / peak];
};
