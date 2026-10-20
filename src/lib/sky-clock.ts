import { viennaZone } from "./blog/dates.ts";
import { type LatLon, roundPlace } from "./geo.ts";

const minuteMs = 60_000;
const hourMs = 3_600_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

interface WallParts {
  day: number;
  hour: number;
  minute: number;
  month: number;
  year: number;
}

const formatterFor = (timeZone: string): Intl.DateTimeFormat => {
  const known = formatters.get(timeZone);
  if (known) return known;
  const made = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    hour: "numeric",
    hourCycle: "h23",
    minute: "numeric",
    month: "numeric",
    timeZone,
    year: "numeric",
  });
  formatters.set(timeZone, made);
  return made;
};

const wallParts = (instant: number, timeZone: string): WallParts => {
  const found: Record<string, number> = {};
  for (const part of formatterFor(timeZone).formatToParts(instant)) {
    found[part.type] = Number(part.value);
  }
  return {
    day: found["day"] ?? 1,
    hour: found["hour"] ?? 0,
    minute: found["minute"] ?? 0,
    month: found["month"] ?? 1,
    year: found["year"] ?? 1970,
  };
};

const offsetMs = (instant: number, timeZone: string): number => {
  const parts = wallParts(instant, timeZone);
  const wall = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute
  );
  return wall - Math.floor(instant / minuteMs) * minuteMs;
};

export const wallMinutes = (instant: number, timeZone: string): number => {
  const parts = wallParts(instant, timeZone);
  return parts.hour * 60 + parts.minute;
};

export const wallInstant = (
  base: number,
  minutes: number,
  timeZone: string
): number => {
  const parts = wallParts(base, timeZone);
  const guess = Date.UTC(parts.year, parts.month - 1, parts.day, 0, minutes);
  const first = guess - offsetMs(guess, timeZone);
  return guess - offsetMs(first, timeZone);
};

export const isTimeZone = (zone: string): boolean => {
  try {
    formatterFor(zone);
    return true;
  } catch {
    return false;
  }
};

const spotKey = (spot: LatLon): string => {
  const rounded = roundPlace(spot);
  return `${String(rounded.lat)},${String(rounded.lon)}`;
};

const zones = new Map<string, string>();

export const setPlaceZone = (spot: LatLon, zone: string | undefined): void => {
  if (zone && isTimeZone(zone)) zones.set(spotKey(spot), zone);
};

const fixedZone = (hours: number): string => {
  if (hours === 0) return "Etc/GMT";
  return hours > 0 ? `Etc/GMT-${String(hours)}` : `Etc/GMT+${String(-hours)}`;
};

export const zoneFor = (
  place: LatLon & { kind: string },
  known: string | undefined,
  browser: string,
  instant: number
): string => {
  if (place.kind === "vienna") return viennaZone;
  if (known) return known;
  const hours = Math.round(place.lon / 15);
  const near = Math.abs(hours - offsetMs(instant, browser) / hourMs) <= 1;
  return near ? browser : fixedZone(hours);
};

export const placeZone = (place: LatLon & { kind: string }): string =>
  zoneFor(
    place,
    zones.get(spotKey(place)),
    new Intl.DateTimeFormat().resolvedOptions().timeZone,
    Date.now()
  );
