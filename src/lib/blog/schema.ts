import * as z from "zod";

import { skyPhaseNames } from "../sky-clock.ts";
import { weatherStates } from "../weather.ts";

const nonEmpty = z.string().trim().min(1);

const dateMessage =
  "Use a real date as YYYY-MM-DD, for example 2026-10-20 (a post goes live at 00:00 Vienna time on that day)";

const updatedMessage = "Use a real date as YYYY-MM-DD, for example 2026-10-20";

const day = (error: string): z.ZodISODate => z.iso.date({ error });

export const frontmatterSchema = z
  .strictObject({
    date: day(dateMessage),
    description: nonEmpty.max(160),
    draft: z.boolean().default(false),
    sky: z.strictObject({
      phase: z.enum(skyPhaseNames),
      weather: z.enum(weatherStates),
    }),
    tags: z.array(nonEmpty).min(1).max(5),
    title: nonEmpty,
    updated: day(updatedMessage).optional(),
  })
  .refine((meta) => meta.updated === undefined || meta.updated >= meta.date, {
    error: "updated must not be before date",
    path: ["updated"],
  });

export interface PostMeta extends Frontmatter {
  readingMinutes: number;
  slug: string;
  url: string;
  wordCount: number;
}

type Frontmatter = z.infer<typeof frontmatterSchema>;
