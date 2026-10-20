import { wallInstant, wallMinutes } from "./sky-clock.ts";
import {
  clampStep,
  clampStop,
  skyRanges,
  stopBlend,
  weatherStops,
} from "./sky-range.ts";
import {
  fallbackWeatherName,
  mixWeather,
  type SkyWeather,
  type WeatherName,
  weatherPresets,
} from "./weather.ts";

export interface Preview {
  time: PreviewTime;
  weather: PreviewWeather;
}
export type PreviewTime = number | undefined;

export type PreviewWeather = number | undefined;

export interface ShownTime {
  live: boolean;
  minutes: number;
}

export interface ShownWeather {
  live: boolean;
  stop: number;
}

export const previewMotion = { inkLeadMs: 100, skyMs: 350 } as const;

export const previewEvent = "sky:preview";

export const liveWeatherEvent = "sky:live-weather";

const { stepMinutes } = skyRanges.time;

export const stepToMinutes = (step: number): number =>
  clampStep(step) * stepMinutes;

export const minutesToStep = (minutes: number): number =>
  clampStep(minutes / stepMinutes);

const two = (value: number): string => String(value).padStart(2, "0");

export const clockLabel = (minutes: number): string =>
  `${two(Math.floor(minutes / 60))}:${two(minutes % 60)}`;

export const hourLabel = (hour: number): string => two(hour);

export const resolveInstant = (
  time: PreviewTime,
  pinned: number | undefined,
  now: number,
  timeZone: string
): number => {
  const base = pinned ?? now;
  return typeof time === "number" ? wallInstant(base, time, timeZone) : base;
};

export const shownTime = (
  time: PreviewTime,
  pinned: number | undefined,
  now: number,
  timeZone: string
): ShownTime => {
  if (typeof time === "number") return { live: false, minutes: time };
  return time === undefined && pinned !== undefined
    ? { live: false, minutes: wallMinutes(pinned, timeZone) }
    : { live: true, minutes: wallMinutes(now, timeZone) };
};

export const weatherStop = (name: WeatherName): number =>
  Math.max(0, weatherStops.indexOf(name));

export const weatherAtStop = (stop: number): SkyWeather => {
  const { from, share, to } = stopBlend(stop);
  if (share <= 0) return weatherPresets[from];
  return share >= 1
    ? weatherPresets[to]
    : mixWeather(weatherPresets[from], weatherPresets[to], share);
};

export const shownWeather = (
  weather: PreviewWeather,
  fromUrl: undefined | WeatherName,
  live: undefined | WeatherName
): ShownWeather => {
  if (weather !== undefined) return { live: false, stop: clampStop(weather) };
  return fromUrl === undefined
    ? { live: true, stop: weatherStop(live ?? fallbackWeatherName) }
    : { live: false, stop: weatherStop(fromUrl) };
};

export const forcedWeather = (
  weather: PreviewWeather,
  fromUrl: undefined | WeatherName
): SkyWeather | undefined => {
  if (weather !== undefined) return weatherAtStop(weather);
  return fromUrl === undefined ? undefined : weatherPresets[fromUrl];
};

let state: Preview = { time: undefined, weather: undefined };

let liveName: undefined | WeatherName;

export const liveWeather = (): undefined | WeatherName => liveName;

export const setLiveWeather = (
  name: undefined | WeatherName,
  target: EventTarget = globalThis
): void => {
  if (name === liveName) return;
  liveName = name;
  target.dispatchEvent(new CustomEvent(liveWeatherEvent));
};

export const previewState = (): Preview => state;

const publish = (next: Preview, target: EventTarget): void => {
  state = next;
  target.dispatchEvent(
    new CustomEvent<Preview>(previewEvent, { detail: next })
  );
};

export const setPreviewTime = (
  time: PreviewTime,
  target: EventTarget = globalThis
): void => {
  publish({ ...state, time }, target);
};

export const setPreviewWeather = (
  weather: PreviewWeather,
  target: EventTarget = globalThis
): void => {
  publish({ ...state, weather }, target);
};

export const resetPreview = (target: EventTarget = globalThis): void => {
  publish({ time: undefined, weather: undefined }, target);
};
