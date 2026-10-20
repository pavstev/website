import { type LatLon, roundPlace } from "./geo.ts";
import { parseReport, type WeatherReport } from "./weather.ts";

export const weatherStaleMs = 1_800_000;

const cacheMs = 900_000;
const defaultTimeoutMs = 8000;
const endpoint = "https://api.open-meteo.com/v1/forecast";
const fields =
  "cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,weather_code,wind_speed_10m,wind_direction_10m,visibility,relative_humidity_2m,precipitation";

export interface WeatherDeps {
  fetch: (url: string, init: { signal: AbortSignal }) => Promise<Response>;
  now: () => number;
  store: Pick<Storage, "getItem" | "setItem"> | undefined;
  timeoutMs?: number;
}

const sessionStore = (): WeatherDeps["store"] => {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
};

export const browserWeatherDeps = (): WeatherDeps => ({
  fetch: (url, init) => globalThis.fetch(url, init),
  now: Date.now,
  store: sessionStore(),
});

const running = new Map<string, Promise<undefined | WeatherReport>>();

const placeKey = (place: LatLon): string =>
  `${String(place.lat)},${String(place.lon)}`;

export const weatherUrl = (place: LatLon): string => {
  const spot = roundPlace(place);
  return `${endpoint}?latitude=${String(spot.lat)}&longitude=${String(spot.lon)}&current=${fields}`;
};

interface CacheEntry {
  at: number;
  body: unknown;
}

const isEntry = (value: unknown): value is CacheEntry =>
  typeof value === "object" &&
  value !== null &&
  "at" in value &&
  typeof value.at === "number";

const readCache = (
  deps: WeatherDeps,
  key: string
): undefined | WeatherReport => {
  try {
    const raw = deps.store?.getItem(key);
    if (!raw) return undefined;
    const entry: unknown = JSON.parse(raw);
    if (!isEntry(entry)) return undefined;
    const age = deps.now() - entry.at;
    return age < 0 || age >= cacheMs ? undefined : parseReport(entry.body);
  } catch {
    return undefined;
  }
};

const writeCache = (deps: WeatherDeps, key: string, body: unknown): void => {
  try {
    deps.store?.setItem(key, JSON.stringify({ at: deps.now(), body }));
  } catch {}
};

const request = async (
  place: LatLon,
  deps: WeatherDeps,
  key: string
): Promise<undefined | WeatherReport> => {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, deps.timeoutMs ?? defaultTimeoutMs);
  try {
    const response = await deps.fetch(weatherUrl(place), {
      signal: controller.signal,
    });
    if (!response.ok) return undefined;
    const body: unknown = await response.json();
    const report = parseReport(body);
    if (report) writeCache(deps, key, body);
    return report;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
};

const settle = async (
  place: LatLon,
  deps: WeatherDeps,
  key: string,
  id: string
): Promise<undefined | WeatherReport> => {
  try {
    return await request(place, deps, key);
  } finally {
    running.delete(id);
  }
};

export const loadWeather = (
  place: LatLon,
  deps: WeatherDeps
): Promise<undefined | WeatherReport> => {
  const spot = roundPlace(place);
  const id = placeKey(spot);
  const key = `sky-weather:${id}`;
  const cached = readCache(deps, key);
  if (cached) return Promise.resolve(cached);
  const pending = running.get(id);
  if (pending) return pending;
  const next = settle(spot, deps, key, id);
  running.set(id, next);
  return next;
};

export const samePlace = (a: LatLon, b: LatLon): boolean => {
  const left = roundPlace(a);
  const right = roundPlace(b);
  return left.lat === right.lat && left.lon === right.lon;
};

export const weatherAllowed = (flags: {
  crawler: boolean;
  home: boolean;
  lightLoad: boolean;
  pinned: boolean;
}): boolean =>
  flags.home && !flags.crawler && !flags.lightLoad && !flags.pinned;
