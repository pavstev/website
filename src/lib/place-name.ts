import { distanceKm, type LatLon } from "./geo.ts";

export interface NearPlace extends PlaceName {
  km: number;
}

export interface PlaceName {
  country: string;
  name: string;
}

export type PlaceTable = readonly Entry[];

interface Entry extends LatLon, PlaceName {}

export const approxRadiusKm = 300;

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

export const windowStart = (table: PlaceTable, minLat: number): number => {
  let low = 0;
  let high = table.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    const entry = table[middle];
    if (entry && entry.lat < minLat) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
};

export const nearbyPlace = (
  table: PlaceTable,
  spot: LatLon,
  maxKm: number = approxRadiusKm
): NearPlace | undefined => {
  const window = maxKm / kmPerDegree;
  const top = spot.lat + window;
  let best: Entry | undefined;
  let bestKm = maxKm;
  for (let index = windowStart(table, spot.lat - window); ; index += 1) {
    const entry = table[index];
    if (!entry || entry.lat > top) {
      break;
    }

    const km = distanceKm(spot, entry);
    if (!(km <= bestKm)) {
      continue;
    }

    best = entry;
    bestKm = km;
  }
  return best && { country: best.country, km: bestKm, name: best.name };
};

export const nearestPlace = (
  table: PlaceTable,
  spot: LatLon,
  maxKm: number = placeRadiusKm
): PlaceName | undefined => {
  const found = nearbyPlace(table, spot, maxKm);
  return found && { country: found.country, name: found.name };
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
