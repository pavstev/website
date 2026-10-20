import { type Robots } from "./page-metadata.ts";

export interface BuildEnv {
  BLOG_BUILT_AT?: string | undefined;
  BLOG_DRAFTS?: string | undefined;
  BLOG_FIXTURES?: string | undefined;
  CI?: string | undefined;
  NODE_ENV?: string | undefined;
  WORKERS_CI?: string | undefined;
}

export const showDrafts = (env: BuildEnv = process.env): boolean =>
  env.NODE_ENV === "development" || env.BLOG_DRAFTS === "1";

export const fixturesEnabled = (env: BuildEnv = process.env): boolean =>
  env.BLOG_FIXTURES === "1" &&
  env.NODE_ENV !== "production" &&
  (env.CI ?? "") === "" &&
  (env.WORKERS_CI ?? "") === "" &&
  (env.BLOG_BUILT_AT ?? "") === "";

export const builtInstant = (env: BuildEnv = process.env): Date | undefined => {
  const text = env.BLOG_BUILT_AT?.trim() ?? "";
  if (text === "") return undefined;
  const instant = new Date(text);
  return Number.isNaN(instant.getTime()) ? undefined : instant;
};

export const pageRobots: Robots = {
  follow: true,
  googleBot: {
    follow: true,
    index: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
  index: true,
};
