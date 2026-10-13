import type { Metadata } from "next";

export interface BuildEnv {
  BLOG_BUILT_AT?: string | undefined;
  BLOG_DRAFTS?: string | undefined;
  NODE_ENV?: string | undefined;
}

export const showDrafts = (env: BuildEnv = process.env): boolean =>
  env.NODE_ENV === "development" || env.BLOG_DRAFTS === "1";

export const builtInstant = (env: BuildEnv = process.env): Date | undefined => {
  const text = env.BLOG_BUILT_AT?.trim() ?? "";
  if (text === "") return undefined;
  const instant = new Date(text);
  return Number.isNaN(instant.getTime()) ? undefined : instant;
};

export const pageRobots: NonNullable<Metadata["robots"]> = {
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
