import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { brotliCompressSync, constants } from "node:zlib";

import type { Check, Page, Result } from "./types.ts";

import { newResult, note, pageSlug, root, skip } from "./lib.ts";

type Kind = "css" | "font" | "html" | "image" | "js" | "other";

interface Total {
  br: number;
  count: number;
  raw: number;
}

const textExt = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".svg",
  ".txt",
  ".webmanifest",
  ".xml",
]);
const imageExt = new Set([
  ".avif",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);
const kinds: Record<string, Kind> = {
  ".css": "css",
  ".html": "html",
  ".js": "js",
  ".woff": "font",
  ".woff2": "font",
};
const scriptAttr =
  /\s(?:component-url|renderer-url|before-hydration-url)="([^"]+)"/gu;
const importPattern = /\b(?:import|export)\b[^"'()]*["'](\.[^"']+\.js)["']/gu;

const kindOf = (file: string): Kind => {
  const ext = path.extname(file).toLowerCase();
  return kinds[ext] ?? (imageExt.has(ext) ? "image" : "other");
};

const brotli = (buffer: Buffer): number =>
  brotliCompressSync(buffer, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
  }).length;

const walk = (dist: string): string[] => {
  const skipped = path.join(dist, "dev") + path.sep;
  return readdirSync(dist, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter((file) => !file.startsWith(skipped));
};

const htmlFile = (dist: string, pagePath: string): string =>
  pagePath === "/"
    ? path.join(dist, "index.html")
    : path.join(dist, `${pagePath.replace(/^\//u, "")}.html`);

const distPath = (url: string): string =>
  decodeURIComponent(new URL(url, "http://x").pathname);

const crawl = (dist: string, url: string, seen: Set<string>): void => {
  const pathname = distPath(url);
  const file = path.join(dist, pathname);
  if (seen.has(pathname) || !pathname.endsWith(".js") || !existsSync(file))
    return;
  seen.add(pathname);
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(importPattern))
    crawl(
      dist,
      path.posix.join(path.posix.dirname(pathname), match[1] ?? ""),
      seen
    );
};

const brotliOf = (dist: string, urls: string[]): number => {
  let sum = 0;
  const unique = new Set(urls);
  for (const url of unique) {
    const file = path.join(dist, distPath(url));
    if (existsSync(file)) sum += brotli(readFileSync(file));
  }
  return sum;
};

const matches = (text: string, pattern: RegExp): string[] =>
  text
    .matchAll(pattern)
    .map((match) => match[1] ?? "")
    .toArray();

const totalDist = (result: Result, dist: string): number => {
  const totals: Partial<Record<Kind, Total>> = {};
  const files = walk(dist);
  for (const file of files) {
    const buffer = readFileSync(file);
    const kind = kindOf(file);
    const total = totals[kind] ?? { br: 0, count: 0, raw: 0 };
    totals[kind] = total;
    total.raw += buffer.length;
    total.br += textExt.has(path.extname(file))
      ? brotli(buffer)
      : buffer.length;
    total.count += 1;
  }
  const rows = Object.entries(totals).toSorted((a, b) => b[1].raw - a[1].raw);
  for (const [kind, total] of rows) {
    note(
      result,
      "info",
      `dist ${kind.padEnd(6)} ${String(total.count).padStart(4)} files ${(total.raw / 1024).toFixed(1).padStart(9)} KB raw ${(total.br / 1024).toFixed(1).padStart(8)} KB brotli`
    );
    result.metrics[`dist_${kind}_kb`] = Math.round(total.raw / 1024);
  }
  return files.length;
};

const measurePage = (
  result: Result,
  page: Page,
  dist: string,
  before: number | undefined
): void => {
  const file = htmlFile(dist, page.path);
  if (!existsSync(file)) {
    note(
      result,
      "warn",
      `${page.path}: no HTML file at ${path.relative(dist, file)}`
    );
    return;
  }
  const html = readFileSync(file);
  const text = html.toString("utf8");
  const direct = matches(text, /<script[^>]*\ssrc="([^"]+)"/gu);
  const islands = matches(text, scriptAttr);
  const seen = new Set<string>();
  for (const url of [...direct, ...islands]) crawl(dist, url, seen);
  const scripts = [...direct, ...islands, ...seen];
  const tags = text
    .matchAll(/<link[^>]*>/gu)
    .map((match) => match[0])
    .filter((tag) => tag.includes('rel="stylesheet"'))
    .toArray();
  const styles = tags.flatMap((tag) => matches(tag, /href="([^"]+)"/gu));
  const js = brotliOf(dist, scripts);
  const css = brotliOf(dist, styles);
  const slug = pageSlug(page.url);
  const htmlBr = brotli(html);
  result.metrics[`js_br_kb_${slug}`] = Number((js / 1024).toFixed(1));
  result.metrics[`css_br_kb_${slug}`] = Number((css / 1024).toFixed(1));
  result.metrics[`html_br_kb_${slug}`] = Number((htmlBr / 1024).toFixed(1));
  note(
    result,
    "info",
    `${page.path}: first-load JS ${(js / 1024).toFixed(1)} KB brotli in ${String(new Set(scripts).size)} files, CSS ${(css / 1024).toFixed(1)} KB, HTML ${(htmlBr / 1024).toFixed(1)} KB`
  );
  if (before !== undefined && js / 1024 > before * 1.05)
    note(
      result,
      "warn",
      `${page.path}: first-load JS grew from ${String(before)} KB to ${(js / 1024).toFixed(1)} KB (more than 5%)`
    );
};

const check: Check = (context) => {
  if (!context.local)
    return Promise.resolve(skip("sizes", "no local build to measure"));
  const result = newResult("sizes");
  const dist = path.join(root, "dist");
  const count = totalDist(result, dist);
  const pages = context.pages.filter((page) => page.kind !== "404");
  const firstPost = pages.find((page) => page.kind === "post");
  const measured = pages.filter(
    (page) => page.kind !== "post" || page === firstPost
  );
  const baseline = context.baseline?.results.find(
    (entry) => entry.name === "sizes"
  );
  for (const page of measured)
    measurePage(
      result,
      page,
      dist,
      baseline?.metrics[`js_br_kb_${pageSlug(page.url)}`]
    );
  const home = result.metrics["js_br_kb_home"];
  result.summary = `home first-load JS ${String(home ?? "?")} KB brotli, dist ${String(count)} files`;
  return Promise.resolve(result);
};

export default check;
