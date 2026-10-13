import type { ViennaWeather, WeatherState } from "./weather.ts";

export const weatherConditions = [
  "clear",
  "mainlyClear",
  "partly",
  "overcast",
  "fog",
  "drizzle",
  "rain",
  "snow",
  "storm",
] as const;

export type WeatherCondition = (typeof weatherConditions)[number];

export const weatherIconNames = [
  "lucide:sun",
  "lucide:moon",
  "lucide:cloud-sun",
  "lucide:cloud-moon",
  "lucide:cloud",
  "lucide:cloud-fog",
  "lucide:cloud-drizzle",
  "lucide:cloud-rain",
  "lucide:cloud-snow",
  "lucide:cloud-lightning",
] as const;

export type WeatherIconName = (typeof weatherIconNames)[number];

const ranges: ReadonlyArray<readonly [number, number, WeatherCondition]> = [
  [0, 0, "clear"],
  [1, 1, "mainlyClear"],
  [2, 2, "partly"],
  [3, 3, "overcast"],
  [45, 48, "fog"],
  [51, 57, "drizzle"],
  [61, 67, "rain"],
  [71, 77, "snow"],
  [80, 82, "rain"],
  [85, 86, "snow"],
  [95, 99, "storm"],
];

export const conditionOfCode = (code: number): WeatherCondition =>
  ranges.find(([low, high]) => code >= low && code <= high)?.[2] ?? "overcast";

const stateConditions: Readonly<Record<WeatherState, WeatherCondition>> = {
  clear: "clear",
  fog: "fog",
  overcast: "overcast",
  partly: "partly",
  rain: "rain",
  snow: "snow",
  storm: "storm",
};

export const conditionOfState = (state: WeatherState): WeatherCondition =>
  stateConditions[state];

export const iconOf = (
  condition: WeatherCondition,
  day: boolean
): WeatherIconName => {
  switch (condition) {
    case "clear": {
      return day ? "lucide:sun" : "lucide:moon";
    }
    case "drizzle": {
      return "lucide:cloud-drizzle";
    }
    case "fog": {
      return "lucide:cloud-fog";
    }
    case "mainlyClear":
    case "partly": {
      return day ? "lucide:cloud-sun" : "lucide:cloud-moon";
    }
    case "overcast": {
      return "lucide:cloud";
    }
    case "rain": {
      return "lucide:cloud-rain";
    }
    case "snow": {
      return "lucide:cloud-snow";
    }
    case "storm": {
      return "lucide:cloud-lightning";
    }
  }
};

const compass = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

export const compassPoint = (degrees: number): string =>
  compass[Math.round((((degrees % 360) + 360) % 360) / 45) % 8] ?? "N";

export const formatTemperature = (celsius: number): string =>
  `${String(Math.round(celsius))}\u{A0}°C`;

const oneDecimal = (value: number): string =>
  String(Math.round(value * 10) / 10);

export interface WeatherReport {
  condition: WeatherCondition;
  precipitation: undefined | { amount: string; kind: "rain" | "snow" };
  temperature: string | undefined;
  wind: { from: string; speed: string };
}

export const reportOf = (weather: ViennaWeather): WeatherReport => {
  const rain = weather.rain + weather.showers;
  let precipitation: WeatherReport["precipitation"];
  if (weather.snow > 0) {
    precipitation = {
      amount: `${oneDecimal(weather.snow)}\u{A0}cm`,
      kind: "snow",
    };
  } else if (rain > 0) {
    precipitation = { amount: `${oneDecimal(rain)}\u{A0}mm`, kind: "rain" };
  }
  return {
    condition: conditionOfCode(weather.code),
    precipitation,
    temperature:
      weather.temperature === undefined
        ? undefined
        : formatTemperature(weather.temperature),
    wind: {
      from: compassPoint(weather.windDirection),
      speed: `${String(Math.round(weather.windSpeed))}\u{A0}km/h`,
    },
  };
};
