import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const postsDir = "dist/blog";
const linkPattern = /<link\b[^>]*>/giu;
const attributePattern =
  /([^\s"'=<>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gu;

const attributesOf = (tag: string): Map<string, string> => {
  const attributes = new Map<string, string>();
  const inner = tag.replace(/^<link\b/iu, "").replace(/\/?>$/u, "");
  for (const match of inner.matchAll(attributePattern)) {
    const [, name = "", quoted, single, bare] = match;
    const key = name.toLowerCase();
    if (!attributes.has(key)) {
      attributes.set(key, quoted ?? single ?? bare ?? "");
    }
  }
  return attributes;
};

const hasToken = (value: string | undefined, token: string): boolean =>
  value?.toLowerCase().split(/\s+/u).includes(token) === true;

export const imagePreloads = (html: string): string[] =>
  (html.match(linkPattern) ?? []).filter((tag) => {
    const attributes = attributesOf(tag);
    return (
      hasToken(attributes.get("rel"), "preload") &&
      attributes.get("as")?.trim().toLowerCase() === "image"
    );
  });

export const postPages = (dir: string = postsDir): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
        .map((entry) => path.join(dir, entry.name))
        .toSorted((a, b) => a.localeCompare(b))
    : [];

export const findPreloads = (
  dir: string = postsDir
): Array<{ file: string; tags: string[] }> =>
  postPages(dir)
    .map((file) => ({
      file,
      tags: imagePreloads(readFileSync(file, "utf8")),
    }))
    .filter((page) => page.tags.length > 0);

if (import.meta.main) {
  const pages = postPages();
  const offenders = findPreloads();
  if (offenders.length > 0) {
    for (const { file, tags } of offenders) {
      console.error(`${file} holds an image preload: ${tags.join(" ")}`);
    }
    console.error(
      "A post page must not preload an image. Keep <picture> a server element in BlogImage."
    );
    process.exitCode = 1;
  } else {
    console.warn(`Preload guard passed: ${String(pages.length)} post pages.`);
  }
}
