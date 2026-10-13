import * as z from "zod";

const nonEmpty = z.string().trim().min(1);

const instantPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-](?:0\d|1[0-4]):[0-5]\d$/u;

const instantMessage =
  "Use a full date and time with its offset, for example 2026-10-13T09:30:00+02:00 (a date alone is not enough)";

const instant = (): z.ZodString =>
  z
    .string({ error: instantMessage })
    .regex(instantPattern, { error: instantMessage })
    .refine(
      (text) => z.iso.datetime({ offset: true }).safeParse(text).success,
      {
        error: instantMessage,
      }
    );

export const instantMs = (iso: string): number => new Date(iso).getTime();

export const frontmatterSchema = z
  .strictObject({
    date: instant(),
    description: nonEmpty.max(160),
    draft: z.boolean().default(false),
    tags: z.array(nonEmpty).min(1).max(5),
    title: nonEmpty,
    updated: instant().optional(),
  })
  .refine(
    (meta) =>
      meta.updated === undefined ||
      instantMs(meta.updated) >= instantMs(meta.date),
    { error: "updated must not be before date", path: ["updated"] }
  );

export interface PostMeta extends Frontmatter {
  readingMinutes: number;
  slug: string;
  url: string;
  wordCount: number;
}

type Frontmatter = z.infer<typeof frontmatterSchema>;
