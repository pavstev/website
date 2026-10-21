import { personalData } from "../../src/lib/personal.ts";

export const live = personalData.website;

export const notFoundPath = "/audit-missing-page";
export const profileHosts = ["github.com", "linkedin.com"];

const kinds: Array<[string, RegExp]> = [
  ["home", /^\/$/u],
  ["blog", /^\/blog$/u],
  ["listing", /^\/blog\/(?:tag|page)\//u],
  ["post", /^\/blog\//u],
];

export const expectedLd: Record<string, string[][]> = {
  blog: [["Blog", "CollectionPage"]],
  home: [["WebSite"], ["ProfilePage"], ["Person"]],
  post: [["BlogPosting", "Article"]],
};

export const classify = (pathname: string): string =>
  kinds.find(([, pattern]) => pattern.test(pathname))?.[0] ?? "other";

export { key as indexNowKey } from "../indexnow.ts";
