import { nightPhase, type SkyPhase } from "./sky-clock.ts";

export interface SkyClouds {
  cover: number;
  fog: number;
  high: number;
  overcast: number;
}

export interface SkyLook {
  clouds: SkyClouds;
  daylight: SkyPhase;
}

export type SkyMode = "blog" | "home";

export const earthClouds: Readonly<SkyClouds> = {
  cover: 0.6,
  fog: 0,
  high: 0.5,
  overcast: 0,
};

export const blogLook = (): SkyLook => ({
  clouds: { cover: 0.12, fog: 0, high: 0.15, overcast: 0 },
  daylight: { ...nightPhase },
});
