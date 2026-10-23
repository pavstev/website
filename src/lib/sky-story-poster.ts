import { clamp01 } from "./math.ts";
import { safeSkyTable } from "./sky-light.ts";
import { paintScene, type Rgb, tableInput } from "./sky-paint.ts";
import { viennaPlace } from "./sky-place.ts";
import { storyInstant, storyWeather } from "./sky-story.ts";

export interface StoryPoster {
  bright: boolean;
  low: string;
  mid: string;
  top: string;
}

const posterView = { height: 900, width: 1440 };
const darkInkFrom = 0.18;

const byte = (value: number): string =>
  Math.round(clamp01(value) * 255)
    .toString(16)
    .padStart(2, "0");

export const hexOf = (color: Rgb): string =>
  `#${byte(color[0])}${byte(color[1])}${byte(color[2])}`;

const linear = (value: number): number =>
  value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;

const lightness = (color: Rgb): number =>
  0.2126 * linear(color[0]) +
  0.7152 * linear(color[1]) +
  0.0722 * linear(color[2]);

export const posterAt = (index: number): StoryPoster => {
  const instant = storyInstant(index);
  const weather = storyWeather(index);
  const table = safeSkyTable(
    tableInput(instant, posterView, weather, viennaPlace)
  );
  const scene = paintScene(instant, posterView, weather, viennaPlace, table);
  return {
    bright: (lightness(scene.mid) + lightness(scene.low)) / 2 > darkInkFrom,
    low: hexOf(scene.low),
    mid: hexOf(scene.mid),
    top: hexOf(scene.top),
  };
};

export const posterStyle = (poster: StoryPoster): string =>
  `--sky-top: ${poster.top}; --sky-mid: ${poster.mid}; --sky-low: ${poster.low}`;
