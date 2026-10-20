export interface LatLon {
  lat: number;
  lon: number;
}

export const vienna: Readonly<LatLon> = { lat: 48.2082, lon: 16.3738 };

const earthRadiusKm = 6371;

const tenth = (value: number): number => Math.round(value * 10) / 10;

const wrapLongitude = (lon: number): number =>
  tenth(((((lon + 180) % 360) + 360) % 360) - 180);

export const sameSpot = (a: LatLon, b: LatLon): boolean =>
  a.lat === b.lat && a.lon === b.lon;

export const roundPlace = (spot: LatLon): LatLon => {
  const lat = Math.min(90, Math.max(-90, tenth(spot.lat)));
  const lon = wrapLongitude(tenth(spot.lon));
  return { lat: lat + 0, lon: lon + 0 };
};

const radians = (degrees: number): number => (degrees * Math.PI) / 180;

export const distanceKm = (a: LatLon, b: LatLon): number => {
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.lat)) *
      Math.cos(radians(b.lat)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
};
