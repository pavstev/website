import { distanceKm, type LatLon } from "./geo.ts";

export interface PlaceName {
  country: string;
  name: string;
}

export type PlaceTable = readonly Entry[];

interface Entry extends LatLon, PlaceName {}

export const placeRadiusKm = 30;

const kmPerDegree = 111.2;

const maxName = 60;

export const decodePlaces = (text: string): PlaceTable => {
  const rows: Entry[] = [];
  let lat = 0;
  for (const line of text.split("\n")) {
    const first = line.indexOf(",");
    const second = line.indexOf(",", first + 1);
    const third = line.indexOf(",", second + 1);
    const step = Number(line.slice(0, first));
    const lon = Number(line.slice(first + 1, second));
    const country = line.slice(second + 1, third);
    const name = line.slice(third + 1).slice(0, maxName);
    if (!(
      third > second &&
      Number.isFinite(step) &&
      Number.isFinite(lon) &&
      country.length === 2 &&
      name.length > 0
    )) {
      continue;
    }

    lat += step;
    rows.push({ country, lat: lat / 10, lon: lon / 10, name });
  }
  return rows;
};

export const nearestPlace = (
  table: PlaceTable,
  spot: LatLon,
  maxKm: number = placeRadiusKm
): PlaceName | undefined => {
  const window = maxKm / kmPerDegree;
  let best: Entry | undefined;
  let bestKm = maxKm;
  for (const entry of table) {
    if (!(Math.abs(entry.lat - spot.lat) <= window)) {
      continue;
    }

    const km = distanceKm(spot, entry);
    if (!(km <= bestKm)) {
      continue;
    }

    best = entry;
    bestKm = km;
  }
  return best && { country: best.country, name: best.name };
};

let regions: Intl.DisplayNames | undefined;

export const countryName = (code: string): string => {
  try {
    regions ??= new Intl.DisplayNames(["en"], { type: "region" });
    return regions.of(code) ?? code;
  } catch {
    return code;
  }
};
