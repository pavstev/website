import * as z from "zod";

const text = (): z.ZodDefault<z.ZodString> => z.string().default("");

const texts = (): z.ZodDefault<z.ZodArray<z.ZodString>> =>
  z.array(z.string()).default([]);

const isHttpLink = (value: string): boolean => {
  const trimmed = value.trim();
  return (
    trimmed === "" ||
    (/^https?:\/\//i.test(trimmed) &&
      URL.canParse(trimmed) &&
      new URL(trimmed).hostname !== "")
  );
};

const contributionSchema = z.object({
  description: text(),
  title: text(),
});

const contributions = (): z.ZodDefault<z.ZodArray<typeof contributionSchema>> =>
  z.array(contributionSchema).default([]);

const basicsSchema = z
  .object({
    email: text(),
    githubHandle: text(),
    headline: text(),
    linkedinHandle: text(),
    location: text(),
    name: text(),
    phone: text(),
    pictureUrl: text(),
    websiteUrl: text(),
    workRights: text(),
  })
  .prefault({});

const experienceItemSchema = z.object({
  company: text(),
  contributions: contributions(),
  from: text(),
  location: text(),
  overview: text(),
  position: text(),
  skills: texts(),
  to: text(),
  websiteUrl: text(),
});

const educationItemSchema = z.object({
  area: text(),
  contributions: contributions(),
  degree: text(),
  from: text(),
  location: text(),
  overview: text(),
  school: text(),
  skills: texts(),
  to: text(),
  websiteUrl: text(),
});

const skillItemSchema = z.object({ keywords: texts(), name: text() });

const languageItemSchema = z.object({ fluency: text(), language: text() });

const projectItemSchema = z.object({
  contributions: contributions(),
  from: text(),
  name: text(),
  overview: text(),
  skills: texts(),
  to: text(),
  websiteUrl: z.string().refine(isHttpLink).default(""),
});

const sectionOf = <T extends z.ZodType>(
  itemSchema: T
): z.ZodPrefault<z.ZodObject<{ items: z.ZodDefault<z.ZodArray<T>> }>> =>
  z.object({ items: z.array(itemSchema).default([]) }).prefault({});

export const cvSchema = z.object({
  basics: basicsSchema,
  education: sectionOf(educationItemSchema),
  experience: sectionOf(experienceItemSchema),
  languages: sectionOf(languageItemSchema),
  projects: sectionOf(projectItemSchema),
  skills: sectionOf(skillItemSchema),
  summary: text(),
  updatedAt: z.iso.datetime({ offset: true }),
});

export type Cv = z.infer<typeof cvSchema>;
