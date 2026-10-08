import { z } from "zod";

const contributionSchema = z.object({
  description: z.string(),
  title: z.string(),
});

const roleSchema = z.object({
  company: z.string(),
  contributions: z.array(contributionSchema).default([]),
  from: z.string(),
  overview: z.string().default(""),
  position: z.string(),
  skills: z.array(z.string()).default([]),
  to: z.string(),
});

const skillGroupSchema = z.object({
  keywords: z.array(z.string()).default([]),
  name: z.string().default(""),
});

const projectSchema = z.object({
  contributions: z.array(contributionSchema).default([]),
  from: z.string().default(""),
  name: z.string(),
  overview: z.string().default(""),
  skills: z.array(z.string()).default([]),
  to: z.string().default(""),
  websiteUrl: z.string().default(""),
});

const cvSchema = z.object({
  basics: z.object({
    headline: z.string(),
    location: z.string(),
    name: z.string(),
  }),
  experience: z.object({ items: z.array(roleSchema) }),
  projects: z.object({ items: z.array(projectSchema) }).optional(),
  skills: z.object({ items: z.array(skillGroupSchema) }).optional(),
  summary: z.string(),
  updatedAt: z.string(),
});

export interface Facts {
  cv: Cv;
  llms: string;
}
type Cv = z.infer<typeof cvSchema>;

type Project = NonNullable<Cv["projects"]>["items"][number];

type Role = Cv["experience"]["items"][number];

const cache = new Map<string, Promise<Facts>>();

const readAsset = async (
  assets: Fetcher,
  origin: string,
  path: string
): Promise<Response> => {
  const response = await assets.fetch(`${origin}${path}`);

  if (response.status !== 200) {
    throw new Error("facts unavailable");
  }

  return response;
};

const fetchFacts = async (assets: Fetcher, origin: string): Promise<Facts> => {
  const [cvResponse, llmsResponse] = await Promise.all([
    readAsset(assets, origin, "/cv.json"),
    readAsset(assets, origin, "/llms.txt"),
  ]);
  let raw: unknown;

  try {
    raw = await cvResponse.json();
  } catch (error) {
    throw new Error("facts unavailable", { cause: error });
  }

  const parsed = cvSchema.safeParse(raw);

  if (!parsed.success) {
    throw new Error("facts unavailable", { cause: parsed.error });
  }

  return { cv: parsed.data, llms: await llmsResponse.text() };
};

export const loadFacts = async (
  assets: Fetcher,
  origin: string
): Promise<Facts> => {
  const cached = cache.get(origin);

  if (cached) {
    return cached;
  }

  const pending = fetchFacts(assets, origin);
  cache.set(origin, pending);

  try {
    return await pending;
  } catch (error) {
    if (cache.get(origin) === pending) {
      cache.delete(origin);
    }

    throw error;
  }
};

export const compact = (lines: Array<string | undefined>): string[] =>
  lines.filter((line): line is string => Boolean(line?.trim()));

const contributionLine = (item: {
  description: string;
  title: string;
}): string =>
  item.title ? `${item.title}: ${item.description}` : item.description;

export const roleBlock = (role: Role): string =>
  compact([
    `${role.position} at ${role.company} (${role.from} to ${role.to})`,
    role.overview,
    ...role.contributions.map((item) => contributionLine(item)),
    role.skills.length > 0 ? `Skills: ${role.skills.join(", ")}` : undefined,
  ]).join("\n");

const projectBlock = (project: Project): string => {
  const years = [project.from, project.to].filter(Boolean).join(" to ");

  return compact([
    years ? `${project.name} (${years})` : project.name,
    project.overview,
    project.websiteUrl ? `Link: ${project.websiteUrl}` : undefined,
    ...project.contributions.map((item) => contributionLine(item)),
    project.skills.length > 0
      ? `Skills: ${project.skills.join(", ")}`
      : undefined,
  ]).join("\n");
};

export const projectsText = (cv: Cv): string | undefined => {
  const blocks = (cv.projects?.items ?? [])
    .filter((project) => project.name.trim())
    .map((project) => projectBlock(project));

  return blocks.length > 0 ? blocks.join("\n\n") : undefined;
};

export const skillLines = (cv: Cv): string[] =>
  (cv.skills?.items ?? [])
    .filter((group) => group.keywords.length > 0)
    .map((group) => `${group.name}: ${group.keywords.join(", ")}`);
