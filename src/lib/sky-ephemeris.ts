import { deg } from "./math.ts";
const msPerDay = 86_400_000;
const julianUnixEpoch = 2_440_587.5;
const j2000 = 2_451_545;
const deltaTSeconds = 69;
const earthRadiusKm = 6378.14;
const auKm = 149_597_870.7;
const moonRadiusKm = 1737.4;
const sunRadiusArcsec = 959.63;
const sunParallaxArcsec = 8.794;
const flattening = 0.99664719;
const sunHorizonDeg = -0.833;
const moonRefractionDeg = 0.5667;
const scanStepMs = 600_000;

export interface MoonIllumination {
  brightLimb: number;
  brightLimbFromZenith: number;
  fraction: number;
  phase: number;
  phaseAngle: number;
}
export interface MoonPosition extends Horizontal {
  angularRadius: number;
  distanceKm: number;
  parallacticAngle: number;
}

export interface RiseSet {
  rise: null | number;
  set: null | number;
}

export interface SunPosition extends Horizontal {
  angularRadius: number;
  distanceKm: number;
}

interface Equatorial {
  dec: number;
  distanceKm: number;
  longitude: number;
  ra: number;
}

interface Horizontal {
  altitude: number;
  azimuth: number;
  trueAltitude: number;
}

type LatitudeTerm = readonly [number, number, number, number, number];

type Term = readonly [number, number, number, number, number, number];

const moonLongitudeDistance: readonly Term[] = [
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
  [3, 0, -1, 0, -892, 3258],
  [2, 1, 1, 0, -810, 2616],
  [4, -1, -2, 0, 759, -1897],
  [0, 2, -1, 0, -713, -2117],
  [2, 2, -1, 0, -700, 2354],
  [2, 1, -2, 0, 691, 0],
  [2, -1, 0, -2, 596, 0],
  [4, 0, 1, 0, 549, -1423],
  [0, 0, 4, 0, 537, -1117],
  [4, -1, 0, 0, 520, -1571],
  [1, 0, -2, 0, -487, -1739],
  [2, 1, 0, -2, -399, 0],
  [0, 0, 2, -2, -381, -4421],
  [1, 1, 1, 0, 351, 0],
  [3, 0, -2, 0, -340, 0],
  [4, 0, -3, 0, 330, 0],
  [2, -1, 2, 0, 327, 0],
  [0, 2, 1, 0, -323, 1165],
  [1, 1, -1, 0, 299, 0],
  [2, 0, 3, 0, 294, 0],
  [2, 0, -1, -2, 0, 8752],
];

const moonLatitude: readonly LatitudeTerm[] = [
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
  [4, 0, 0, -1, 1021],
  [4, 0, -1, 1, 833],
];

const wrap360 = (value: number): number => ((value % 360) + 360) % 360;

const wrap180 = (value: number): number => {
  const wrapped = wrap360(value);
  return wrapped > 180 ? wrapped - 360 : wrapped;
};

const sinD = (value: number): number => Math.sin(value * deg);
const cosD = (value: number): number => Math.cos(value * deg);

const toMs = (instant: Date | number): number =>
  typeof instant === "number" ? instant : instant.getTime();

const julianDay = (ms: number): number => ms / msPerDay + julianUnixEpoch;

const centuries = (ms: number): number =>
  (julianDay(ms + deltaTSeconds * 1000) - j2000) / 36_525;

export const nutation = (
  t: number
): { longitude: number; obliquity: number; trueObliquity: number } => {
  const node = 125.04452 - 1934.136261 * t;
  const sunMean = 280.4665 + 36_000.7698 * t;
  const moonMean = 218.3165 + 481_267.8813 * t;
  const longitude =
    (-17.2 * sinD(node) -
      1.32 * sinD(2 * sunMean) -
      0.23 * sinD(2 * moonMean) +
      0.21 * sinD(2 * node)) /
    3600;
  const obliquityShift =
    (9.2 * cosD(node) +
      0.57 * cosD(2 * sunMean) +
      0.1 * cosD(2 * moonMean) -
      0.09 * cosD(2 * node)) /
    3600;
  const obliquity =
    23.43929111 - (46.815 * t + 0.00059 * t * t - 0.001813 * t * t * t) / 3600;
  return {
    longitude,
    obliquity,
    trueObliquity: obliquity + obliquityShift,
  };
};

const toEquatorial = (
  longitude: number,
  latitude: number,
  obliquity: number
): { dec: number; ra: number } => ({
  dec:
    Math.asin(
      sinD(latitude) * cosD(obliquity) +
        cosD(latitude) * sinD(obliquity) * sinD(longitude)
    ) / deg,
  ra: wrap360(
    Math.atan2(
      sinD(longitude) * cosD(obliquity) -
        Math.tan(latitude * deg) * sinD(obliquity),
      cosD(longitude)
    ) / deg
  ),
});

const sunEquatorial = (ms: number): Equatorial => {
  const t = centuries(ms);
  const mean = 280.46646 + 36_000.76983 * t + 0.0003032 * t * t;
  const anomaly = 357.52911 + 35_999.05029 * t - 0.0001537 * t * t;
  const eccentricity = 0.016708634 - 0.000042037 * t - 0.0000001267 * t * t;
  const center =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * sinD(anomaly) +
    (0.019993 - 0.000101 * t) * sinD(2 * anomaly) +
    0.000289 * sinD(3 * anomaly);
  const trueAnomaly = anomaly + center;
  const radius =
    (1.000001018 * (1 - eccentricity * eccentricity)) /
    (1 + eccentricity * cosD(trueAnomaly));
  const nut = nutation(t);
  const longitude = wrap360(
    mean + center - 20.4898 / 3600 / radius + nut.longitude
  );
  const { dec, ra } = toEquatorial(longitude, 0, nut.trueObliquity);
  return { dec, distanceKm: radius * auKm, longitude, ra };
};

const moonEquatorial = (ms: number): Equatorial => {
  const t = centuries(ms);
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;
  const meanLongitude =
    218.3164477 +
    481_267.88123421 * t -
    0.0015786 * t2 +
    t3 / 538_841 -
    t4 / 65_194_000;
  const elongation =
    297.8501921 +
    445_267.1114034 * t -
    0.0018819 * t2 +
    t3 / 545_868 -
    t4 / 113_065_000;
  const sunAnomaly =
    357.5291092 + 35_999.0502909 * t - 0.0001536 * t2 + t3 / 24_490_000;
  const moonAnomaly =
    134.9633964 +
    477_198.8675055 * t +
    0.0087414 * t2 +
    t3 / 69_699 -
    t4 / 14_712_000;
  const node =
    93.272095 +
    483_202.0175233 * t -
    0.0036539 * t2 -
    t3 / 3_526_000 +
    t4 / 863_310_000;
  const e = 1 - 0.002516 * t - 0.0000074 * t2;
  const a1 = 119.75 + 131.849 * t;
  const a2 = 53.09 + 479_264.29 * t;
  const a3 = 313.45 + 481_266.484 * t;
  const eFactor = (m: number): number =>
    m === 0 ? 1 : Math.abs(m) === 1 ? e : e * e;
  let sumL = 0;
  let sumR = 0;
  for (const [d, m, mp, f, l, r] of moonLongitudeDistance) {
    const arg = d * elongation + m * sunAnomaly + mp * moonAnomaly + f * node;
    const k = eFactor(m);
    sumL += l * k * sinD(arg);
    sumR += r * k * cosD(arg);
  }
  let sumB = 0;
  for (const [d, m, mp, f, b] of moonLatitude) {
    const arg = d * elongation + m * sunAnomaly + mp * moonAnomaly + f * node;
    sumB += b * eFactor(m) * sinD(arg);
  }
  sumL += 3958 * sinD(a1) + 1962 * sinD(meanLongitude - node) + 318 * sinD(a2);
  sumB +=
    -2235 * sinD(meanLongitude) +
    382 * sinD(a3) +
    175 * sinD(a1 - node) +
    175 * sinD(a1 + node) +
    127 * sinD(meanLongitude - moonAnomaly) -
    115 * sinD(meanLongitude + moonAnomaly);
  const nut = nutation(t);
  const longitude = wrap360(meanLongitude + sumL / 1e6 + nut.longitude);
  const latitude = sumB / 1e6;
  const { dec, ra } = toEquatorial(longitude, latitude, nut.trueObliquity);
  return { dec, distanceKm: 385_000.56 + sumR / 1000, longitude, ra };
};

export const siderealDeg = (ms: number, longitude: number): number => {
  const jd = julianDay(ms);
  const t = (jd - j2000) / 36_525;
  const nut = nutation(t);
  const mean =
    280.46061837 +
    360.98564736629 * (jd - j2000) +
    0.000387933 * t * t -
    (t * t * t) / 38_710_000;
  return wrap360(mean + nut.longitude * cosD(nut.trueObliquity) + longitude);
};

const refraction = (trueAltitude: number): number => {
  if (trueAltitude < -1.9) return 0;
  const h = Math.max(trueAltitude, -1.9);
  const arcmin = 1.02 / Math.tan((h + 10.3 / (h + 5.11)) * deg);
  return (arcmin + 0.0019279) / 60;
};

const toHorizontal = (
  ra: number,
  dec: number,
  sidereal: number,
  latitude: number
): { altitude: number; azimuth: number; hourAngle: number } => {
  const hourAngle = wrap360(sidereal - ra);
  const altitude =
    Math.asin(
      sinD(latitude) * sinD(dec) + cosD(latitude) * cosD(dec) * cosD(hourAngle)
    ) / deg;
  const azimuth = wrap360(
    Math.atan2(
      sinD(hourAngle),
      cosD(hourAngle) * sinD(latitude) - Math.tan(dec * deg) * cosD(latitude)
    ) /
      deg +
      180
  );
  return { altitude, azimuth, hourAngle };
};

const observerGeocentric = (
  latitude: number
): { rhoCos: number; rhoSin: number } => {
  const u = Math.atan(flattening * Math.tan(latitude * deg));
  return { rhoCos: Math.cos(u), rhoSin: flattening * Math.sin(u) };
};

const topocentric = (
  body: Equatorial,
  sidereal: number,
  latitude: number
): { dec: number; distanceKm: number; ra: number } => {
  const { rhoCos, rhoSin } = observerGeocentric(latitude);
  const x =
    body.distanceKm * cosD(body.dec) * cosD(body.ra) -
    earthRadiusKm * rhoCos * cosD(sidereal);
  const y =
    body.distanceKm * cosD(body.dec) * sinD(body.ra) -
    earthRadiusKm * rhoCos * sinD(sidereal);
  const z = body.distanceKm * sinD(body.dec) - earthRadiusKm * rhoSin;
  const distanceKm = Math.hypot(x, y, z);
  return {
    dec: Math.asin(z / distanceKm) / deg,
    distanceKm,
    ra: wrap360(Math.atan2(y, x) / deg),
  };
};

export const sunPosition = (
  instant: Date | number,
  latitude: number,
  longitude: number
): SunPosition => {
  const ms = toMs(instant);
  const sun = sunEquatorial(ms);
  const place = toHorizontal(
    sun.ra,
    sun.dec,
    siderealDeg(ms, longitude),
    latitude
  );
  const radiusAu = sun.distanceKm / auKm;
  const trueAltitude =
    place.altitude -
    (sunParallaxArcsec / 3600 / radiusAu) * cosD(place.altitude);
  return {
    altitude: trueAltitude + refraction(trueAltitude),
    angularRadius: sunRadiusArcsec / 3600 / radiusAu,
    azimuth: place.azimuth,
    distanceKm: sun.distanceKm,
    trueAltitude,
  };
};

export const moonPosition = (
  instant: Date | number,
  latitude: number,
  longitude: number
): MoonPosition => {
  const ms = toMs(instant);
  const sidereal = siderealDeg(ms, longitude);
  const topo = topocentric(moonEquatorial(ms), sidereal, latitude);
  const place = toHorizontal(topo.ra, topo.dec, sidereal, latitude);
  const parallacticAngle =
    Math.atan2(
      sinD(place.hourAngle),
      Math.tan(latitude * deg) * cosD(topo.dec) -
        sinD(topo.dec) * cosD(place.hourAngle)
    ) / deg;
  return {
    altitude: place.altitude + refraction(place.altitude),
    angularRadius: Math.asin(moonRadiusKm / topo.distanceKm) / deg,
    azimuth: place.azimuth,
    distanceKm: topo.distanceKm,
    parallacticAngle,
    trueAltitude: place.altitude,
  };
};

export const moonIllumination = (
  instant: Date | number,
  latitude: number,
  longitude: number
): MoonIllumination => {
  const ms = toMs(instant);
  const sun = sunEquatorial(ms);
  const sidereal = siderealDeg(ms, longitude);
  const moonGeo = moonEquatorial(ms);
  const moon = topocentric(moonGeo, sidereal, latitude);
  const cosElongation =
    sinD(sun.dec) * sinD(moon.dec) +
    cosD(sun.dec) * cosD(moon.dec) * cosD(sun.ra - moon.ra);
  const elongation = Math.acos(Math.max(-1, Math.min(1, cosElongation)));
  const phaseAngle =
    Math.atan2(
      sun.distanceKm * Math.sin(elongation),
      moon.distanceKm - sun.distanceKm * Math.cos(elongation)
    ) / deg;
  const brightLimb = wrap360(
    Math.atan2(
      cosD(sun.dec) * sinD(sun.ra - moon.ra),
      sinD(sun.dec) * cosD(moon.dec) -
        cosD(sun.dec) * sinD(moon.dec) * cosD(sun.ra - moon.ra)
    ) / deg
  );
  const hourAngle = wrap360(sidereal - moon.ra);
  const parallactic =
    Math.atan2(
      sinD(hourAngle),
      Math.tan(latitude * deg) * cosD(moon.dec) -
        sinD(moon.dec) * cosD(hourAngle)
    ) / deg;
  return {
    brightLimb,
    brightLimbFromZenith: wrap180(brightLimb - parallactic),
    fraction: (1 + cosD(phaseAngle)) / 2,
    phase: wrap360(moonGeo.longitude - sun.longitude) / 360,
    phaseAngle,
  };
};

const findCrossings = (
  start: number,
  height: (ms: number) => number
): RiseSet => {
  let rise: null | number = null;
  let set: null | number = null;
  let previous = height(start);
  for (let at = start + scanStepMs; at <= start + msPerDay; at += scanStepMs) {
    const current = height(at);
    if (previous < 0 !== current < 0) {
      let low = at - scanStepMs;
      let high = at;
      for (let i = 0; i < 20; i += 1) {
        const mid = (low + high) / 2;
        if (height(mid) < 0 === previous < 0) low = mid;
        else high = mid;
      }
      const when = Math.round((low + high) / 2);
      if (rise === null && previous < 0) rise = when;
      if (set === null && previous >= 0) set = when;
    }
    previous = current;
  }
  return { rise, set };
};

export const sunRiseSet = (
  dayStart: Date | number,
  latitude: number,
  longitude: number
): RiseSet =>
  findCrossings(
    toMs(dayStart),
    (ms) => sunPosition(ms, latitude, longitude).trueAltitude - sunHorizonDeg
  );

export const moonRiseSet = (
  dayStart: Date | number,
  latitude: number,
  longitude: number
): RiseSet =>
  findCrossings(toMs(dayStart), (ms) => {
    const moon = moonPosition(ms, latitude, longitude);
    return moon.trueAltitude + moonRefractionDeg + moon.angularRadius;
  });
