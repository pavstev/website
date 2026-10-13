import { clamp, clamp01, smoothstep } from "./math.ts";

export interface SkyWeather {
  cover: number;
  drift: number;
  fog: number;
  high: number;
  overcast: number;
  rain: number;
  slant: number;
  snow: number;
  storm: number;
}

export interface ViennaWeather {
  code: number;
  cover: number;
  high: number;
  low: number;
  mid: number;
  rain: number;
  showers: number;
  snow: number;
  time: string;
  visibility: number;
  windDirection: number;
  windSpeed: number;
}

export const weatherStates = [
  "clear",
  "partly",
  "overcast",
  "rain",
  "snow",
  "fog",
  "storm",
] as const;

export type WeatherState = (typeof weatherStates)[number];

export const weatherSourceUrl = "https://open-meteo.com/";

const deg = Math.PI / 180;
const presetSlant = -0.12;

const numberFields = [
  "code",
  "cover",
  "high",
  "low",
  "mid",
  "rain",
  "showers",
  "snow",
  "visibility",
  "windDirection",
  "windSpeed",
] as const;

const rainByCode: Readonly<Record<number, number>> = {
  51: 0.25,
  53: 0.35,
  55: 0.45,
  56: 0.35,
  57: 0.5,
  61: 0.45,
  63: 0.7,
  65: 1,
  66: 0.5,
  67: 0.8,
  80: 0.5,
  81: 0.75,
  82: 1,
  95: 0.8,
  96: 1,
  99: 1,
};

const snowByCode: Readonly<Record<number, number>> = {
  71: 0.4,
  73: 0.7,
  75: 1,
  77: 0.3,
  85: 0.6,
  86: 1,
};

const fogCodes = new Set([45, 48]);
const stormCodes = new Set([95, 96, 99]);

const calm: Omit<SkyWeather, "cover" | "high" | "overcast"> = {
  drift: 1,
  fog: 0,
  rain: 0,
  slant: presetSlant,
  snow: 0,
  storm: 0,
};

export const fallbackSky: SkyWeather = {
  cover: 0.6,
  drift: 1,
  fog: 0,
  high: 0.5,
  overcast: 0,
  rain: 0,
  slant: 0,
  snow: 0,
  storm: 0,
};

export const weatherPresets: Record<WeatherState, SkyWeather> = {
  clear: { ...calm, cover: 0.12, high: 0.15, overcast: 0 },
  fog: { ...calm, cover: 0.5, fog: 0.85, high: 0, overcast: 0.4 },
  overcast: { ...calm, cover: 1, high: 0.2, overcast: 0.9 },
  partly: { ...calm, cover: 0.6, high: 0.5, overcast: 0.1 },
  rain: { ...calm, cover: 1, fog: 0.15, high: 0, overcast: 1, rain: 0.7 },
  snow: { ...calm, cover: 0.9, fog: 0.1, high: 0, overcast: 0.85, snow: 0.7 },
  storm: {
    ...calm,
    cover: 1,
    fog: 0.1,
    high: 0,
    overcast: 1,
    rain: 0.9,
    storm: 1,
  },
};

export const crawlerSky: SkyWeather = { ...weatherPresets.partly };

const windDrift = (east: number): number =>
  Math.abs(east) < 1
    ? 0.5
    : -Math.sign(east) * clamp(Math.abs(east) / 15, 0.5, 2);

export const skyFromWeather = (weather: ViennaWeather): SkyWeather => {
  const coverPercent = Math.max(
    weather.low,
    0.85 * weather.mid,
    0.6 * weather.cover
  );
  const rain = clamp01(
    Math.max(
      rainByCode[weather.code] ?? 0,
      (weather.rain + weather.showers) / 4
    )
  );
  const snow = clamp01(
    Math.max(snowByCode[weather.code] ?? 0, weather.snow / 2)
  );
  const baseOvercast = 0.9 * smoothstep(55, 100, weather.cover);
  const overcast =
    rain > 0 || snow > 0 ? Math.max(baseOvercast, 0.85) : baseOvercast;
  const mist = 0.85 * (1 - smoothstep(1000, 10_000, weather.visibility));
  const fog = fogCodes.has(weather.code) ? Math.max(mist, 0.85) : mist;
  const east = -Math.sin(weather.windDirection * deg) * weather.windSpeed;

  return {
    cover: clamp01(Math.max(0.12, coverPercent / 100)),
    drift: windDrift(east),
    fog: clamp01(fog),
    high: clamp01(0.1 + (0.9 * weather.high) / 100),
    overcast: clamp01(overcast),
    rain,
    slant: clamp(east / 60, -0.5, 0.5),
    snow,
    storm: stormCodes.has(weather.code) ? 1 : 0,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const finite = (record: Record<string, unknown>, key: string): number => {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : NaN;
};

export const parseViennaWeather = (
  value: unknown
): undefined | ViennaWeather => {
  if (!isRecord(value)) {
    return undefined;
  }

  const { time } = value;

  if (typeof time !== "string" || time.length === 0) {
    return undefined;
  }

  const weather: ViennaWeather = {
    code: finite(value, "code"),
    cover: finite(value, "cover"),
    high: finite(value, "high"),
    low: finite(value, "low"),
    mid: finite(value, "mid"),
    rain: finite(value, "rain"),
    showers: finite(value, "showers"),
    snow: finite(value, "snow"),
    time,
    visibility: finite(value, "visibility"),
    windDirection: finite(value, "windDirection"),
    windSpeed: finite(value, "windSpeed"),
  };

  return numberFields.every((field) => Number.isFinite(weather[field]))
    ? weather
    : undefined;
};

export const isWeatherState = (value: string): value is WeatherState =>
  Object.hasOwn(weatherPresets, value);

export const weatherOverride = (search: string): SkyWeather | undefined => {
  const state = new URLSearchParams(search).get("weather");

  return state !== null && isWeatherState(state)
    ? { ...weatherPresets[state] }
    : undefined;
};

export const readSkyWeather = (body: unknown): SkyWeather | undefined => {
  const weather = isRecord(body)
    ? parseViennaWeather(body["weather"])
    : undefined;
  return weather ? skyFromWeather(weather) : undefined;
};

export const fetchSkyWeather = async (
  signal: AbortSignal
): Promise<SkyWeather | undefined> => {
  try {
    const response = await fetch("/weather", { signal });
    return response.ok ? readSkyWeather(await response.json()) : undefined;
  } catch {
    return undefined;
  }
};
