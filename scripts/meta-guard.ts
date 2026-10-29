import { readFileSync } from "node:fs";

import { personalData } from "../src/lib/personal.ts";
import { attributesOf } from "./preload-guard.ts";

type PageKind = "home" | "notFound";

const metaPattern = /<meta\b[^>]*>/giu;
const titlePattern = /<title>([^<]*)<\/title>/iu;

const metaContent = (
  html: string,
  key: "name" | "property",
  value: string
): string | undefined => {
  const tags = html.match(metaPattern) ?? [];
  for (const tag of tags) {
    const attributes = attributesOf(tag);
    if (attributes.get(key) === value) return attributes.get("content");
  }
  return undefined;
};

export const metaProblems = (
  html: string,
  kind: PageKind,
  website: string
): string[] => {
  const problems: string[] = [];
  const title = titlePattern.exec(html)?.[1];
  const robots = metaContent(html, "name", "robots") ?? "";
  const url = metaContent(html, "property", "og:url");
  if (metaContent(html, "property", "og:title") !== title)
    problems.push("og:title differs from <title>");
  if (metaContent(html, "name", "twitter:title") !== title)
    problems.push("twitter:title differs from <title>");
  if (kind === "home") {
    if (url !== website) problems.push(`og:url is not ${website}`);
    if (robots.includes("noindex")) problems.push("the home page is noindex");
  } else {
    if (!robots.includes("noindex"))
      problems.push("the error page is not noindex");
    if (url !== undefined) problems.push("the error page has an og:url");
  }
  return problems;
};

if (import.meta.main) {
  const pages: Array<[string, PageKind]> = [
    ["dist/index.html", "home"],
    ["dist/404.html", "notFound"],
    ["dist/500.html", "notFound"],
  ];
  let failed = false;
  for (const [file, kind] of pages) {
    const problems = metaProblems(
      readFileSync(file, "utf8"),
      kind,
      personalData.website
    );
    for (const problem of problems) console.error(`${file}: ${problem}`);
    failed ||= problems.length > 0;
  }
  if (failed) process.exitCode = 1;
  else console.warn("Meta guard passed: home, 404 and 500.");
}
