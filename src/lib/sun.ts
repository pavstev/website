const deg = Math.PI / 180;
const msPerDay = 86_400_000;
const unixEpochJulianDay = 2_440_587.5;
const j2000JulianDay = 2_451_545;

interface GeoPoint {
  latitude: number;
  longitude: number;
}

const wrap180 = (value: number): number =>
  ((((value + 180) % 360) + 360) % 360) - 180;

export const subsolarPoint = (date: Date): GeoPoint => {
  const days = date.getTime() / msPerDay + unixEpochJulianDay - j2000JulianDay;
  const meanLongitude = 280.46 + 0.9856474 * days;
  const anomaly = (357.528 + 0.9856003 * days) * deg;
  const eclipticLongitude =
    (meanLongitude + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)) *
    deg;
  const obliquity = (23.439 - 0.0000004 * days) * deg;
  const declination = Math.asin(
    Math.sin(obliquity) * Math.sin(eclipticLongitude)
  );
  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(eclipticLongitude),
    Math.cos(eclipticLongitude)
  );
  const siderealTime = 280.46061837 + 360.98564736629 * days;
  return {
    latitude: declination / deg,
    longitude: wrap180(rightAscension / deg - siderealTime),
  };
};
