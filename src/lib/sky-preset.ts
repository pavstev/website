import { nightPhase, type SkyPhase } from "./sky-clock.ts";
import { type SkyWeather, weatherPresets } from "./weather.ts";

export interface SkyLook {
  daylight: SkyPhase;
  weather: SkyWeather;
}

export type SkyMode = "blog" | "home";

export const blogLook = (): SkyLook => ({
  daylight: { ...nightPhase },
  weather: { ...weatherPresets.clear },
});
