import { clamp01 } from "./math.ts";
import { type WeatherName } from "./weather.ts";

export interface RangeMark<T> {
  mark: T;
  value: number;
}

export interface RangeTick {
  major: boolean;
  value: number;
}

export interface StopBlend {
  from: WeatherName;
  share: number;
  to: WeatherName;
}

export const skyRanges = {
  time: {
    dayMinutes: 1440,
    keyMinutes: 5,
    labelEveryHours: 6,
    pageMinutes: 60,
    stepMinutes: 1,
  },
  weather: {
    icons: {
      clear: "lucide:sun",
      fog: "lucide:cloud-fog",
      overcast: "lucide:cloud",
      partly: "lucide:cloud-sun",
      rain: "lucide:cloud-rain",
      snow: "lucide:cloud-snow",
    } satisfies Readonly<Record<WeatherName, string>>,
    snap: 0.2,
    stepsPerStop: 100,
    stops: [
      "clear",
      "partly",
      "overcast",
      "fog",
      "rain",
      "snow",
    ] satisfies readonly WeatherName[],
  },
} as const;

const { dayMinutes, keyMinutes, labelEveryHours, pageMinutes, stepMinutes } =
  skyRanges.time;

const { snap, stepsPerStop } = skyRanges.weather;

export const stepCount = dayMinutes / stepMinutes;

export const timeKeyStep = keyMinutes / stepMinutes;

export const timePageStep = pageMinutes / stepMinutes;

const stepsPerHour = 60 / stepMinutes;

const dayHours = dayMinutes / 60;

export const weatherStops: readonly WeatherName[] = skyRanges.weather.stops;

export const weatherMax = weatherStops.length - 1;

export const weatherSteps = weatherMax * stepsPerStop;

export const hourMarks: readonly number[] = Array.from(
  { length: dayHours / labelEveryHours + 1 },
  (_, index) => index * labelEveryHours
);

export const hourTicks: readonly RangeTick[] = Array.from(
  { length: dayHours + 1 },
  (_, hour) => ({
    major: hour % labelEveryHours === 0,
    value: hour * stepsPerHour,
  })
);

export const hourLabelMarks: ReadonlyArray<RangeMark<number>> = hourMarks.map(
  (hour) => ({ mark: hour, value: hour * stepsPerHour })
);

const ticksPerGap = Math.round(1 / snap);

export const weatherTicks: readonly RangeTick[] = Array.from(
  { length: weatherMax * ticksPerGap + 1 },
  (_, index) => ({
    major: index % ticksPerGap === 0,
    value: (index * stepsPerStop) / ticksPerGap,
  })
);

export const weatherLabelMarks: ReadonlyArray<RangeMark<WeatherName>> =
  weatherStops.map((name, stop) => ({
    mark: name,
    value: stop * stepsPerStop,
  }));

const clamp = (value: number, max: number): number =>
  Math.min(max, Math.max(0, Math.round(value)));

export const clampStep = (step: number): number => clamp(step, stepCount);

export const clampStop = (stop: number): number =>
  clamp(stop * stepsPerStop, weatherSteps) / stepsPerStop;

export const snapStop = (stop: number): number => {
  const position = clampStop(stop);
  const near = Math.round(position);
  const reach = Math.round((snap / 2) * stepsPerStop);
  return Math.round(Math.abs(position - near) * stepsPerStop) <= reach
    ? near
    : position;
};

export const stopBlend = (stop: number): StopBlend => {
  const position = clampStop(stop);
  const low = Math.min(Math.floor(position), weatherMax - 1);
  const from = weatherStops[low] ?? "clear";
  const to = weatherStops[low + 1] ?? from;
  return { from, share: position - low, to };
};

export const rangeShare = (value: number, max: number): number =>
  max > 0 ? clamp01(value / max) : 0;

export const pointerValue = (
  x: number,
  left: number,
  width: number,
  max: number
): number | undefined =>
  width > 0 ? clamp(((x - left) / width) * max, max) : undefined;

const gridUp = (value: number, step: number): number =>
  (Math.floor(value / step) + 1) * step;

const gridDown = (value: number, step: number): number =>
  (Math.ceil(value / step) - 1) * step;

export interface ModifierKeys {
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export const plainKey = (keys: ModifierKeys): boolean =>
  !keys.altKey && !keys.ctrlKey && !keys.metaKey;

export const keyValue = (
  key: string,
  value: number,
  max: number,
  step: number,
  page: number
): number | undefined => {
  const moves: Readonly<Record<string, () => number>> = {
    ArrowDown: () => gridDown(value, step),
    ArrowLeft: () => gridDown(value, step),
    ArrowRight: () => gridUp(value, step),
    ArrowUp: () => gridUp(value, step),
    End: () => max,
    Home: () => 0,
    PageDown: () => gridDown(value, page),
    PageUp: () => gridUp(value, page),
  };
  const move = Object.hasOwn(moves, key) ? moves[key] : undefined;
  return move ? clamp(move(), max) : undefined;
};
