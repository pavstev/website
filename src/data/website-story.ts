import { viennaZone } from "../lib/blog/dates.ts";
import { wallMinutes } from "../lib/sky-clock.ts";
import { type SkyStoryStep, storyInstant } from "../lib/sky-story.ts";

export const skyStoryMeta = { updatedAt: "2026-10-24" };

export interface SkyStoryCopy {
  chapter: string;
  id: SkyStoryStep;
  line: string;
  note: string;
  screens: number;
}

export interface SkyStorySlide extends SkyStoryCopy {
  clock: string | undefined;
  lamp: "moon" | "sun";
}

const sunSteps: ReadonlySet<SkyStoryStep> = new Set([
  "midday",
  "morning",
  "sunrise",
  "sunset",
  "weather",
]);

export const skyStoryCopy: readonly SkyStoryCopy[] = [
  {
    chapter: "Blue hour",
    id: "hero",
    line: "A real sky, painted",
    note: "The sky behind my contact card is not a picture. It is the real sky over one place, painted live in your browser. Scroll down and one whole day goes by.",
    screens: 1,
  },
  {
    chapter: "Sunrise",
    id: "sunrise",
    line: "The sun is computed",
    note: "Every frame asks where the sun stands at this exact minute. Astronomy formulas give its height and its direction. So the sun rises when it really rises, not when I say so.",
    screens: 1.3,
  },
  {
    chapter: "Morning",
    id: "morning",
    line: "Light makes the colors",
    note: "There is no hand-picked gradient. A small model of the air scatters sunlight the way the real sky does. It fills a table of 40 by 24 colors while the browser is idle, and the shader reads from it.",
    screens: 1.3,
  },
  {
    chapter: "Midday",
    id: "midday",
    line: "Clouds drawn in pixels",
    note: "Every cloud is pixel art. The cells are two pixels wide, in six flat tones, with a hard edge and a lit rim. The wind moves them, and a swipe pushes them along.",
    screens: 1.3,
  },
  {
    chapter: "Rain front",
    id: "weather",
    line: "The weather is live",
    note: "On the home page your browser asks Open-Meteo for the weather where you are. Cloud, rain, snow and fog then ease in over a few seconds. Here a rain front rolls in and clears, so you can watch it happen.",
    screens: 3,
  },
  {
    chapter: "Sunset",
    id: "sunset",
    line: "The words read the sky",
    note: "No text here sits in a box. The page reads the pixels behind each line and picks a light or a dark ink. A soft glow does the rest.",
    screens: 1.3,
  },
  {
    chapter: "Night",
    id: "night",
    line: "The moon, on time",
    note: "The moon follows the same kind of math as the sun. Its place matches the JPL Horizons tables within 0.006 degrees. Its face is drawn from a map of the real seas and craters.",
    screens: 1.3,
  },
  {
    chapter: "Late night",
    id: "yours",
    line: "Now make it yours",
    note: "The sky starts over my home. On the home page, open the sky panel and pick your own place on a night globe. Your place is rounded to about ten kilometers before anything sees it.",
    screens: 1.3,
  },
  {
    chapter: "Now",
    id: "outro",
    line: "See it live",
    note: "This page plays one fixed day. The home page shows the sky as it is right now.",
    screens: 1,
  },
];

export const clockOf = (index: number): string => {
  const minutes = wallMinutes(storyInstant(index), viennaZone);
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  return `${hours}:${String(minutes % 60).padStart(2, "0")}`;
};

export const skyStorySlides = (): SkyStorySlide[] =>
  skyStoryCopy.map((copy, index) => ({
    ...copy,
    clock: copy.id === "outro" ? undefined : clockOf(index),
    lamp: sunSteps.has(copy.id) ? "sun" : "moon",
  }));
