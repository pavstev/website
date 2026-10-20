import { deg } from "./math.ts";
const msPerDay = 86_400_000;
const julianUnixEpoch = 2_440_587.5;
const j2000 = 2_451_545;
const deltaTSeconds = 69;
const auKm = 149_597_870.7;
const sunRadiusArcsec = 959.63;
const sunParallaxArcsec = 8.794;

export interface Equatorial {
  dec: number;
  distanceKm: number;
  longitude: number;
  ra: number;
}

export interface SunPosition extends Horizontal {
  angularRadius: number;
  distanceKm: number;
}

interface Horizontal {
  altitude: number;
  azimuth: number;
  trueAltitude: number;
}

export const wrap360 = (value: number): number => ((value % 360) + 360) % 360;

export const sinD = (value: number): number => Math.sin(value * deg);
export const cosD = (value: number): number => Math.cos(value * deg);

const toMs = (instant: Date | number): number =>
  typeof instant === "number" ? instant : instant.getTime();

const julianDay = (ms: number): number => ms / msPerDay + julianUnixEpoch;

export const centuries = (ms: number): number =>
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

export const toEquatorial = (
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

export const sunEquatorial = (ms: number): Equatorial => {
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

export const refraction = (trueAltitude: number): number => {
  if (trueAltitude < -1.9) return 0;
  const h = Math.max(trueAltitude, -1.9);
  const arcmin = 1.02 / Math.tan((h + 10.3 / (h + 5.11)) * deg);
  return (arcmin + 0.0019279) / 60;
};

export const toHorizontal = (
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
