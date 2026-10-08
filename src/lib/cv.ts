import { readFile } from "node:fs/promises";
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

export type CvFeedFailure = "config" | "invalid" | "refused" | "unavailable";

type CvSource = "feed" | "live";

type FeedEnv = Record<string, string | undefined>;

export class CvFeedError extends Error {
  readonly kind: CvFeedFailure;

  constructor(kind: CvFeedFailure, message: string) {
    super(message);
    this.name = "CvFeedError";
    this.kind = kind;
  }
}

const feedPath = "/api/public/cv";

const feedTimeoutMs = 20_000;

const liveLabel = "Live /cv.json";

const loopbackHosts = new Set(["127.0.0.1", "[::1]", "localhost"]);

export const cvCachePath = ".cv/cv.json";

export const cvSourcePath = ".cv/source";

const isAllowedFeed = (url: URL): boolean =>
  url.protocol === "https:" ||
  (url.protocol === "http:" && loopbackHosts.has(url.hostname));

export const stripPrivate = (cv: Cv): Cv => ({
  ...cv,
  basics: { ...cv.basics, phone: "" },
});

const feedRequest = (env: FeedEnv): { headers: Headers; url: URL } => {
  const base = env["CV_FEED_URL"];
  const token = env["CV_FEED_TOKEN"];
  if (!base || !token) {
    throw new CvFeedError(
      "config",
      "CV feed needs CV_FEED_URL and CV_FEED_TOKEN"
    );
  }
  if (!URL.canParse(feedPath, base)) {
    throw new CvFeedError("config", "CV_FEED_URL is not a URL");
  }
  const url = new URL(feedPath, base);
  if (!isAllowedFeed(url)) {
    throw new CvFeedError("config", "CV_FEED_URL must be https");
  }
  try {
    return {
      headers: new Headers({
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "stevanpavlovic.com build",
      }),
      url,
    };
  } catch {
    throw new CvFeedError(
      "config",
      "CV_FEED_TOKEN is not a valid header value"
    );
  }
};

const redirectRefused = (error: unknown): boolean =>
  error instanceof Error &&
  error.cause instanceof Error &&
  error.cause.message === "unexpected redirect";

const send = async (
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  label: string
): Promise<Response> => {
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal });
  } catch (error) {
    if (redirectRefused(error)) {
      throw new CvFeedError(
        "config",
        "CV feed answered with a redirect: check CV_FEED_URL"
      );
    }
    throw new CvFeedError("unavailable", `${label} could not be reached`);
  }
};

const readJson = async (
  response: Response,
  label: string
): Promise<unknown> => {
  let body: string;
  try {
    body = await response.text();
  } catch {
    throw new CvFeedError("unavailable", `${label} could not be read`);
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new CvFeedError("invalid", `${label} is not JSON`);
  }
};

const discardBody = async (response: Response): Promise<void> => {
  try {
    await response.body?.cancel();
  } catch {}
};

const exchange = async (
  response: Response,
  label: string,
  failure: (status: number) => CvFeedError
): Promise<unknown> => {
  if (response.status !== 200) {
    await discardBody(response);
    throw failure(response.status);
  }
  return readJson(response, label);
};

const feedFailure = (status: number): CvFeedError => {
  if (status === 404) {
    return new CvFeedError(
      "refused",
      "CV feed 404: check CV_FEED_TOKEN and that the résumé is saved"
    );
  }
  if (status >= 500) {
    return new CvFeedError("unavailable", `CV feed ${String(status)}`);
  }
  return status >= 300 && status < 400
    ? new CvFeedError(
        "config",
        `CV feed ${String(status)}: check that CV_FEED_URL is the final address`
      )
    : new CvFeedError("refused", `CV feed ${String(status)}`);
};

const liveFailure = (status: number): CvFeedError =>
  new CvFeedError("unavailable", `${liveLabel} ${String(status)}`);

const parseCv = (data: unknown, label: string): Cv => {
  const parsed = cvSchema.safeParse(data);
  if (!parsed.success) {
    const fields = parsed.error.issues
      .map((issue) => issue.path.join(".") || "(root)")
      .join(", ");
    throw new CvFeedError(
      "invalid",
      `${label} does not match the résumé schema: ${fields}`
    );
  }
  return stripPrivate(parsed.data);
};

export const fetchFeed = async (
  env: FeedEnv,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = feedTimeoutMs
): Promise<Cv> => {
  const { headers, url } = feedRequest(env);
  const response = await send(
    fetchImpl,
    url.href,
    { headers, redirect: "error" },
    timeoutMs,
    "CV feed"
  );
  return parseCv(await exchange(response, "CV feed", feedFailure), "CV feed");
};

const fetchLive = async (
  liveUrl: string,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<Cv> => {
  if (!URL.canParse(liveUrl) || !isAllowedFeed(new URL(liveUrl))) {
    throw new CvFeedError("config", `${liveLabel} address must be https`);
  }
  const response = await send(
    fetchImpl,
    liveUrl,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "stevanpavlovic.com build",
      },
    },
    timeoutMs,
    liveLabel
  );
  return parseCv(await exchange(response, liveLabel, liveFailure), liveLabel);
};

export const loadCv = async (options: {
  env: FeedEnv;
  fetchImpl?: typeof fetch | undefined;
  liveUrl: string;
  timeoutMs?: number | undefined;
}): Promise<{ cv: Cv; source: CvSource }> => {
  const {
    env,
    fetchImpl = fetch,
    liveUrl,
    timeoutMs = feedTimeoutMs,
  } = options;
  try {
    return { cv: await fetchFeed(env, fetchImpl, timeoutMs), source: "feed" };
  } catch (error) {
    if (!(error instanceof CvFeedError) || error.kind !== "unavailable") {
      throw error;
    }
  }
  return { cv: await fetchLive(liveUrl, fetchImpl, timeoutMs), source: "live" };
};

export const isNewer = (current: Cv, built: Cv): boolean =>
  Date.parse(current.updatedAt) > Date.parse(built.updatedAt);

const readCache = async (): Promise<Cv> => {
  let file: string;
  try {
    file = await readFile(cvCachePath, "utf8");
  } catch {
    throw new CvFeedError(
      "config",
      `${cvCachePath} is missing: run node scripts/cv-fetch.ts first`
    );
  }
  let data: unknown;
  try {
    data = JSON.parse(file);
  } catch {
    throw new CvFeedError("invalid", `${cvCachePath} is not JSON`);
  }
  return parseCv(data, cvCachePath);
};

let cached: Promise<Cv> | undefined;

const readCacheOnce = async (): Promise<Cv> => {
  try {
    return await readCache();
  } catch (error) {
    cached = undefined;
    throw error;
  }
};

export const getCv = (): Promise<Cv> => {
  cached ??= readCacheOnce();
  return cached;
};
