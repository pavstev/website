import { z } from "zod";

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

const feedPath = "/api/public/cv";

const loopbackHosts = new Set(["127.0.0.1", "[::1]", "localhost"]);

const isAllowedFeed = (url: URL): boolean =>
  url.protocol === "https:" ||
  (url.protocol === "http:" && loopbackHosts.has(url.hostname));

export const stripPrivate = (cv: Cv): Cv => ({
  ...cv,
  basics: { ...cv.basics, phone: "" },
});

const feedSettings = (): { token: string; url: URL } => {
  const base = process.env["CV_FEED_URL"];
  const token = process.env["CV_FEED_TOKEN"];
  if (!base || !token) {
    throw new Error("CV feed needs CV_FEED_URL and CV_FEED_TOKEN");
  }
  const url = new URL(feedPath, base);
  if (!isAllowedFeed(url)) {
    throw new Error("CV_FEED_URL must be https");
  }
  return { token, url };
};

export const getCv = async (fetchImpl: typeof fetch = fetch): Promise<Cv> => {
  const { token, url } = feedSettings();
  const response = await fetchImpl(url.href, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "stevanpavlovic.com build",
    },
    next: { revalidate: 1 },
    redirect: "error",
  });
  if (response.status === 404) {
    throw new Error(
      "CV feed 404: check CV_FEED_TOKEN and that the résumé is saved"
    );
  }
  if (response.status !== 200) {
    throw new Error(`CV feed ${String(response.status)}`);
  }
  return stripPrivate(cvSchema.parse(await response.json()));
};
