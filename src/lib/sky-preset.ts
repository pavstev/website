import {
  phaseFromName,
  type SkyPhase,
  type SkyPhaseName,
  skyPhaseNames,
} from "./sky-clock.ts";
import {
  isWeatherState,
  type SkyWeather,
  weatherPresets,
  type WeatherState,
} from "./weather.ts";

export interface SkyLook {
  daylight: SkyPhase;
  weather: SkyWeather;
}

export type SkyMode = "home" | "index" | "post";

export interface SkyPreset {
  phase: SkyPhaseName;
  weather: WeatherState;
}

export const skyPresetEvent = "sky:preset";

let latest: null | SkyPreset = null;

const phaseNames = new Set<unknown>(skyPhaseNames);

const isPhaseName = (value: unknown): value is SkyPhaseName =>
  phaseNames.has(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const detailOf = (event: CustomEvent<unknown>): unknown => event.detail;

export const latestSkyPreset = (): null | SkyPreset => latest;

export const forgetSkyPreset = (): void => {
  latest = null;
};

export const startingSkyPreset = (
  mode: SkyMode,
  crawler: boolean
): null | SkyPreset => (mode === "index" && !crawler ? latest : null);

export const setSkyPreset = (preset: null | SkyPreset): void => {
  latest = preset ? { phase: preset.phase, weather: preset.weather } : null;
  globalThis.dispatchEvent(new CustomEvent(skyPresetEvent, { detail: latest }));
};

export const readSkyPreset = (event: Event): null | SkyPreset | undefined => {
  if (!(event instanceof CustomEvent)) return undefined;
  const detail = detailOf(event);
  if (detail === null) return null;
  if (!isRecord(detail)) return undefined;
  const { phase, weather } = detail;
  return typeof weather === "string" &&
    isWeatherState(weather) &&
    isPhaseName(phase)
    ? { phase, weather }
    : undefined;
};

export const presetLook = (preset: SkyPreset): SkyLook => ({
  daylight: phaseFromName(preset.phase),
  weather: { ...weatherPresets[preset.weather] },
});
