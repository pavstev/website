import { personalData } from "../personal.ts";

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
