import type { Metadata } from "next";

export interface BuildEnv {
  BLOG_DRAFTS?: string | undefined;
  NODE_ENV?: string | undefined;
  WORKERS_CI_BRANCH?: string | undefined;
}

export const isPreviewBuild = (env: BuildEnv = process.env): boolean => {
  const branch = env.WORKERS_CI_BRANCH;
  return branch !== undefined && branch !== "" && branch !== "main";
};

export const showDrafts = (env: BuildEnv = process.env): boolean =>
  isPreviewBuild(env) ||
  env.NODE_ENV === "development" ||
  env.BLOG_DRAFTS === "1";

export const pageRobots = (
  env: BuildEnv = process.env
): NonNullable<Metadata["robots"]> =>
  isPreviewBuild(env)
    ? { follow: false, index: false }
    : {
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
