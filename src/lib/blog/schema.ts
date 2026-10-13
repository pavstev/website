import * as z from "zod";

import { skyPhaseNames } from "../sky-clock.ts";
import { type WeatherState } from "../weather.ts";

export const weatherStates = [
  "clear",
  "partly",
  "overcast",
  "rain",
  "snow",
  "fog",
  "storm",
] as const satisfies readonly WeatherState[];

const nonEmpty = z.string().trim().min(1);

export const frontmatterSchema = z.strictObject({
  date: z.iso.date(),
  description: nonEmpty.max(160),
  draft: z.boolean().default(false),
  sky: z.strictObject({
    phase: z.enum(skyPhaseNames),
    weather: z.enum(weatherStates),
  }),
  tags: z.array(nonEmpty).min(1).max(5),
  title: nonEmpty,
  updated: z.iso.date().optional(),
});

export interface PostMeta extends Frontmatter {
  readingMinutes: number;
  slug: string;
  url: string;
  wordCount: number;
}

type Frontmatter = z.infer<typeof frontmatterSchema>;
