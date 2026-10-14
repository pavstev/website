import { personalData } from "../personal.ts";
import { isBlogPage } from "./slug.ts";

const siteOrigin = new URL(personalData.website).origin;

export const isExternalHref = (href: string): boolean => {
  const lower = href.toLowerCase();
  if (
    ["//", "http://", "https://"].every((prefix) => !lower.startsWith(prefix))
  ) {
    return false;
  }
  try {
    return new URL(href, personalData.website).origin !== siteOrigin;
  } catch {
    return false;
  }
};

export const leavesBlog = (href: string): boolean => {
  if (isExternalHref(href) || !/^(?:\/|https?:)/iu.test(href)) return false;
  try {
    return !isBlogPage(new URL(href, personalData.website).pathname);
  } catch {
    return false;
  }
};
