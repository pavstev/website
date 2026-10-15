import { en } from "../i18n.ts";
import { type PostMeta } from "./schema.ts";

export interface Crumb {
  current: boolean;
  label: string;
  path: string;
}

interface Here {
  label: string;
  path: string;
}

const blogPath = "/blog";

export const crumbTrail = (here?: Here): Crumb[] => {
  const trail: Here[] = [
    { label: en.blog.crumbHome, path: "/" },
    { label: en.blog.heading, path: blogPath },
    ...(here === undefined ? [] : [here]),
  ];
  return trail.map((crumb, index) => ({
    ...crumb,
    current: index === trail.length - 1,
  }));
};

export const postCrumbs = (post: Pick<PostMeta, "slug" | "title">): Crumb[] =>
  crumbTrail({ label: post.title, path: `${blogPath}/${post.slug}` });

export const listingCrumbs = (label: string, url: string): Crumb[] => {
  const path = new URL(url).pathname;
  return crumbTrail(path === blogPath ? undefined : { label, path });
};

export const crumbIsLink = (crumb: Crumb): boolean =>
  !crumb.current || crumb.path === blogPath;
