import { parseViennaWeather, type ViennaWeather } from "../src/lib/weather.ts";
import { failure } from "./http.ts";

const upstreamUrl =
  "https://api.open-meteo.com/v1/forecast?latitude=48.21&longitude=16.37&current=cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,weather_code,rain,showers,snowfall,visibility,wind_speed_10m,wind_direction_10m&timezone=Europe%2FVienna";
const upstreamTimeoutMs = 4000;
const browserCache = "public, max-age=300";
const edgeCache = "public, max-age=900";
const edgeFailureCache = "public, max-age=60";

export interface WeatherCache {
  match: (request: Request) => Promise<Response | undefined>;
  put: (request: Request, response: Response) => Promise<void>;
}

export interface WeatherDeps {
  cache: WeatherCache;
  fetch: (url: string, init: { signal: AbortSignal }) => Promise<Response>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const fromOpenMeteo = (value: unknown): undefined | ViennaWeather => {
  if (!isRecord(value)) {
    return undefined;
  }

  const { current } = value;

  return isRecord(current)
    ? parseViennaWeather({
        code: current["weather_code"],
        cover: current["cloud_cover"],
        high: current["cloud_cover_high"],
        low: current["cloud_cover_low"],
        mid: current["cloud_cover_mid"],
        rain: current["rain"],
        showers: current["showers"],
        snow: current["snowfall"],
        time: current["time"],
        visibility: current["visibility"],
        windDirection: current["wind_direction_10m"],
        windSpeed: current["wind_speed_10m"],
      })
    : undefined;
};

const fromAnswer = (value: unknown): undefined | ViennaWeather =>
  isRecord(value) ? parseViennaWeather(value["weather"]) : undefined;

const weatherJson = (
  weather: undefined | ViennaWeather,
  cacheControl: string
): Response =>
  Response.json(
    { weather: weather ?? null },
    { headers: { "Cache-Control": cacheControl } }
  );

const answer = (weather: undefined | ViennaWeather): Response =>
  weatherJson(weather, weather ? browserCache : "no-store");

const fromCache = async (
  cache: WeatherCache,
  key: Request
): Promise<Response | undefined> => {
  try {
    const cached = await cache.match(key);
    return cached ? answer(fromAnswer(await cached.json())) : undefined;
  } catch {
    return undefined;
  }
};

const fromUpstream = async (
  deps: WeatherDeps
): Promise<undefined | ViennaWeather> => {
  try {
    const response = await deps.fetch(upstreamUrl, {
      signal: AbortSignal.timeout(upstreamTimeoutMs),
    });

    return response.status === 200
      ? fromOpenMeteo(await response.json())
      : undefined;
  } catch {
    return undefined;
  }
};

const store = async (
  cache: WeatherCache,
  key: Request,
  weather: undefined | ViennaWeather
): Promise<void> => {
  try {
    await cache.put(
      key,
      weatherJson(weather, weather ? edgeCache : edgeFailureCache)
    );
  } catch {}
};

export const handleWeather = async (
  request: Request,
  deps: WeatherDeps
): Promise<Response> => {
  if (request.method !== "GET") {
    return failure(405, "method", { Allow: "GET" });
  }

  const key = new Request(`${new URL(request.url).origin}/weather`);
  const cached = await fromCache(deps.cache, key);

  if (cached) {
    return cached;
  }

  const weather = await fromUpstream(deps);
  await store(deps.cache, key, weather);

  return answer(weather);
};
