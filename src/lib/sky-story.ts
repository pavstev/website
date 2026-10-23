import { clamp01 } from "./math.ts";
import {
  mixWeather,
  type SkyWeather,
  type WeatherName,
  weatherPresets,
} from "./weather.ts";

export const skyStorySteps = [
  "hero",
  "sunrise",
  "morning",
  "midday",
  "weather",
  "sunset",
  "night",
  "yours",
  "outro",
] as const;

export type SkyStoryStep = (typeof skyStorySteps)[number];

const clockPoints: ReadonlyArray<readonly [number, string]> = [
  [0, "2026-10-24T04:56:00Z"],
  [1, "2026-10-24T05:36:00Z"],
  [2, "2026-10-24T07:30:00Z"],
  [3, "2026-10-24T10:38:00Z"],
  [4, "2026-10-24T13:10:00Z"],
  [5, "2026-10-24T15:50:00Z"],
  [5.1, "2026-10-24T16:05:00Z"],
  [5.2, "2026-10-24T16:10:00Z"],
  [5.3, "2026-10-24T16:15:00Z"],
  [5.4, "2026-10-24T16:18:00Z"],
  [5.5, "2026-10-24T16:22:00Z"],
  [5.6, "2026-10-24T16:28:00Z"],
  [5.7, "2026-10-24T17:05:00Z"],
  [5.8, "2026-10-24T18:20:00Z"],
  [5.9, "2026-10-24T20:05:00Z"],
  [6, "2026-10-24T21:33:00Z"],
  [7, "2026-10-24T22:40:00Z"],
  [8, "2026-10-24T23:30:00Z"],
];

const weatherKeysAt: ReadonlyArray<readonly [number, WeatherName]> = [
  [0, "clear"],
  [3, "partly"],
  [3.6, "overcast"],
  [4, "rain"],
  [4.6, "partly"],
  [5, "clear"],
];

const smoother = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

const chapters = clockPoints.map(([at]) => at);
const instants = clockPoints.map(([, key]) => Date.parse(key));

const gap = (values: readonly number[], index: number): number =>
  (values[index + 1] ?? 0) - (values[index] ?? 0);

const slopeAt = (index: number): number => {
  if (
    index === 0 ||
    index === chapters.length - 1 ||
    Number.isSafeInteger(chapters[index])
  )
    return 0;
  const before = gap(chapters, index - 1);
  const after = gap(chapters, index);
  const secantBefore = gap(instants, index - 1) / before;
  const secantAfter = gap(instants, index) / after;
  const weightBefore = 2 * after + before;
  const weightAfter = after + 2 * before;
  return (
    (weightBefore + weightAfter) /
    (weightBefore / secantBefore + weightAfter / secantAfter)
  );
};

const slopes = chapters.map((_, index) => slopeAt(index));

export const storyInstant = (chapter: number): number => {
  const last = chapters.length - 1;
  const c = Math.min(Math.max(chapter, 0), chapters[last] ?? 0);
  const index = Math.min(
    Math.max(
      chapters.findLastIndex((at) => at <= c),
      0
    ),
    last - 1
  );
  const start = chapters[index] ?? 0;
  const width = gap(chapters, index);
  const t = clamp01((c - start) / width);
  const from = instants[index] ?? 0;
  const to = instants[index + 1] ?? from;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * from +
    (t3 - 2 * t2 + t) * width * (slopes[index] ?? 0) +
    (3 * t2 - 2 * t3) * to +
    (t3 - t2) * width * (slopes[index + 1] ?? 0)
  );
};

export const storyWeather = (chapter: number): SkyWeather => {
  const next = weatherKeysAt.findIndex(([at]) => at > chapter);
  const end = weatherKeysAt.at(-1) ?? [0, "clear"];
  if (next === -1) return { ...weatherPresets[end[1]] };
  const [toAt, toName] = weatherKeysAt[next] ?? end;
  const [fromAt, fromName] = weatherKeysAt[next - 1] ?? [toAt, toName];
  const share = toAt > fromAt ? (chapter - fromAt) / (toAt - fromAt) : 1;
  return mixWeather(
    weatherPresets[fromName],
    weatherPresets[toName],
    smoother(clamp01(share))
  );
};
