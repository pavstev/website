import { clamp, deg, mix } from "./math.ts";
import { isRecord } from "./record.ts";

export interface SkyWeather {
  alto: number;
  cirrus: number;
  cumulus: number;
  fog: number;
  haze: number;
  overcast: number;
  rain: number;
  snow: number;
  windFrom: number | undefined;
  windKmh: number;
}

export type WeatherKey = Exclude<keyof SkyWeather, "windFrom">;

export const weatherKeys: readonly WeatherKey[] = [
  "alto",
  "cirrus",
  "cumulus",
  "fog",
  "haze",
  "overcast",
  "rain",
  "snow",
  "windKmh",
];

export const mixWeather = (
  from: Readonly<SkyWeather>,
  to: Readonly<SkyWeather>,
  share: number
): SkyWeather => ({
  ...mix(from, to, share),
  windFrom: from.windFrom ?? to.windFrom,
});

export type WeatherName =
  "clear" | "fog" | "overcast" | "partly" | "rain" | "snow";

export interface WeatherReport {
  at: string;
  code: number;
  cover: number;
  coverHigh: number | undefined;
  coverLow: number | undefined;
  coverMid: number | undefined;
  humidity: number | undefined;
  precipitation: number;
  visibility: number | undefined;
  windFrom: number;
  windKmh: number;
  zone: string | undefined;
}

export type WeatherWord =
  "clear" | "cloudy" | "drizzle" | "fog" | "partly" | "rain" | "snow" | "storm";

const calmWind = 14;
const baseDrift = 1.6;
const overcastDeck = 0.92;
const overcastCover = 85;
const rainDeck = 0.88;
const snowDeck = 0.8;
const fogDeck = 0.25;
const fogVisibility = 1000;
const defaultVisibility = 24_000;
const defaultHumidity = 60;

const still = {
  alto: 0,
  cirrus: 0,
  cumulus: 0,
  fog: 0,
  haze: 1,
  overcast: 0,
  rain: 0,
  snow: 0,
  windFrom: undefined,
  windKmh: calmWind,
} as const;

export const weatherPresets: Readonly<Record<WeatherName, SkyWeather>> = {
  clear: { ...still, cirrus: 0.1, cumulus: 0.12, haze: 0.9 },
  fog: { ...still, cumulus: 0.35, fog: 1, haze: 2.5, overcast: fogDeck },
  overcast: {
    ...still,
    alto: 0.6,
    cirrus: 0.2,
    cumulus: 0.75,
    haze: 1.3,
    overcast: overcastDeck,
  },
  partly: { ...still, alto: 0.25, cirrus: 0.3, cumulus: 0.5 },
  rain: {
    ...still,
    alto: 0.6,
    cirrus: 0.1,
    cumulus: 0.8,
    haze: 1.8,
    overcast: rainDeck,
    rain: 1,
  },
  snow: {
    ...still,
    alto: 0.5,
    cirrus: 0.1,
    cumulus: 0.7,
    haze: 1.6,
    overcast: snowDeck,
    snow: 1,
  },
};

export const fallbackWeatherName: WeatherName = "partly";

export const fallbackWeather: Readonly<SkyWeather> =
  weatherPresets[fallbackWeatherName];

export const nightWeather: Readonly<SkyWeather> = weatherPresets.partly;

export const weatherGoal = (
  home: boolean,
  fixed: SkyWeather | undefined,
  reported: SkyWeather | undefined
): SkyWeather => (home ? (fixed ?? reported ?? fallbackWeather) : nightWeather);

const isWeatherName = (value: string): value is WeatherName =>
  Object.hasOwn(weatherPresets, value);

export const weatherNameOverride = (
  search: string
): undefined | WeatherName => {
  const value = new URLSearchParams(search).get("weather");
  return value !== null && isWeatherName(value) ? value : undefined;
};

export const weatherOverride = (search: string): SkyWeather | undefined => {
  const name = weatherNameOverride(search);
  return name === undefined ? undefined : weatherPresets[name];
};

const within = (code: number, low: number, high: number): boolean =>
  code >= low && code <= high;

export const weatherWord = (code: number): WeatherWord => {
  if (code === 0 || code === 1) return "clear";
  if (code === 2) return "partly";
  if (code === 45 || code === 48) return "fog";
  if (within(code, 51, 57)) return "drizzle";
  if (within(code, 61, 67) || within(code, 80, 82)) return "rain";
  if (snowOf(code) > 0) return "snow";
  return within(code, 95, 99) ? "storm" : "cloudy";
};

const wordNames: Readonly<Record<WeatherWord, WeatherName>> = {
  clear: "clear",
  cloudy: "overcast",
  drizzle: "rain",
  fog: "fog",
  partly: "partly",
  rain: "rain",
  snow: "snow",
  storm: "rain",
};

export const weatherNameOf = (code: number): WeatherName =>
  wordNames[weatherWord(code)];

const rainOf = (code: number): number => {
  if (within(code, 51, 57)) return 0.3;
  if (within(code, 61, 67) || within(code, 80, 82)) return 0.6;
  return within(code, 95, 99) ? 1 : 0;
};

const snowOf = (code: number): number =>
  code === 85 || code === 86 || within(code, 71, 77) ? 1 : 0;

const share = (percent: number): number => clamp(percent / 100, 0, 1);

const percentOf = (value = 0): number => clamp(value, 0, 100);

const hazeOf = (
  visibility: number | undefined,
  humidity: number | undefined
): number => {
  const km = (visibility ?? defaultVisibility) / 1000;
  let visTerm = 1;
  if (km > 40) visTerm = 0.8;
  else if (km < 20) visTerm = 1 + (1.5 * (20 - Math.max(km, 2))) / 18;
  const wet = humidity ?? defaultHumidity;
  const humTerm = wet < 70 ? 0 : 1 + (1.5 * (clamp(wet, 70, 95) - 70)) / 25;
  return Math.max(visTerm, humTerm);
};

const rainStrength = (code: number, precipitation: number): number => {
  if (snowOf(code) > 0) return 0;
  const amount =
    precipitation > 0
      ? clamp(0.3 + (0.7 * (precipitation - 0.1)) / 0.9, 0.3, 1)
      : 0;
  return Math.max(amount, rainOf(code));
};

export const skyWeather = (report: WeatherReport): SkyWeather => {
  const layered =
    report.coverLow !== undefined ||
    report.coverMid !== undefined ||
    report.coverHigh !== undefined;
  const cumulus = share(layered ? (report.coverLow ?? 0) : report.cover);
  const alto = layered ? share(report.coverMid ?? 0) : 0;
  const cirrus = layered ? share(report.coverHigh ?? 0) : 0;
  const rain = rainStrength(report.code, report.precipitation);
  const snow = snowOf(report.code);
  const fog =
    report.code === 45 ||
    report.code === 48 ||
    (report.visibility !== undefined && report.visibility < fogVisibility)
      ? 1
      : 0;
  const lowAndMid = layered
    ? percentOf(report.coverLow) + percentOf(report.coverMid)
    : percentOf(report.cover);
  const deck = lowAndMid > overcastCover ? overcastDeck : 0;
  return {
    alto,
    cirrus,
    cumulus,
    fog,
    haze: hazeOf(report.visibility, report.humidity),
    overcast: Math.max(
      deck,
      rain > 0 ? rainDeck : 0,
      snow > 0 ? snowDeck : 0,
      fog > 0 ? fogDeck : 0
    ),
    rain,
    snow,
    windFrom: report.windFrom,
    windKmh: Math.max(0, report.windKmh),
  };
};

export const windDrift = (
  windKmh: number,
  windFrom: number | undefined,
  viewAzimuth: number
): number => {
  const speed = baseDrift * clamp(windKmh / calmWind, 0.4, 2.5);
  if (windFrom === undefined) return speed;
  const side = Math.sin((windFrom + 180 - viewAzimuth) * deg);
  return side < 0 ? -speed : speed;
};

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const optional = (value: unknown): number | undefined =>
  finite(value) ? value : undefined;

export const parseReport = (body: unknown): undefined | WeatherReport => {
  if (!isRecord(body)) return undefined;
  const { current, timezone } = body;
  if (!isRecord(current)) return undefined;
  const {
    cloud_cover: cover,
    cloud_cover_high: coverHigh,
    cloud_cover_low: coverLow,
    cloud_cover_mid: coverMid,
    precipitation,
    relative_humidity_2m: humidity,
    time: at,
    visibility,
    weather_code: code,
    wind_direction_10m: windFrom,
    wind_speed_10m: windKmh,
  } = current;
  return typeof at !== "string" ||
    !finite(code) ||
    !finite(cover) ||
    !finite(windFrom) ||
    !finite(windKmh)
    ? undefined
    : {
        at,
        code,
        cover,
        coverHigh: optional(coverHigh),
        coverLow: optional(coverLow),
        coverMid: optional(coverMid),
        humidity: optional(humidity),
        precipitation: optional(precipitation) ?? 0,
        visibility: optional(visibility),
        windFrom,
        windKmh,
        zone: typeof timezone === "string" ? timezone : undefined,
      };
};
