import { AxeBuilder } from "@axe-core/playwright";
import { type Page as PwPage } from "playwright-core";

import type { Check, Page, Result } from "./types.ts";

import {
  count,
  merge,
  newResult,
  pixelDiff,
  pool,
  reporter,
  sizes,
  withPage,
} from "./lib.ts";

const tags = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
  "best-practice",
];

interface FocusInfo {
  box: { height: number; width: number; x: number; y: number };
  key: string;
  label: string;
  obscured: boolean;
  onScreen: boolean;
}

const readFocus = (): FocusInfo | null => {
  const element = document.activeElement;
  if (!element || element === document.body) return null;
  const rect = element.getBoundingClientRect();
  const text = (element.getAttribute("aria-label") ?? element.textContent ?? "")
    .trim()
    .replaceAll(/\s+/gu, " ")
    .slice(0, 30);
  const hit = document.elementFromPoint(
    rect.left + rect.width / 2,
    rect.top + rect.height / 2
  );
  const id = element.id ? `#${element.id}` : "";
  return {
    box: { height: rect.height, width: rect.width, x: rect.left, y: rect.top },
    key: `${element.tagName}|${element.id}|${text}|${String(Math.round(rect.left))}|${String(Math.round(rect.top + scrollY))}`,
    label: `${element.tagName.toLowerCase()}${id} "${text}"`,
    obscured:
      rect.width > 0 &&
      hit !== null &&
      hit !== element &&
      !element.contains(hit) &&
      !hit.contains(element),
    onScreen:
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.top < innerHeight &&
      rect.right > 0 &&
      rect.left < innerWidth,
  };
};

const blurFocus = (): void => {
  if (document.activeElement instanceof HTMLElement)
    document.activeElement.blur();
};

const refocus = (key: string): void => {
  const [tag = "", id = "", , left = "", top = ""] = key.split("|", 5);
  const match = [...document.querySelectorAll<HTMLElement>(tag)].find(
    (element) =>
      element.id === id &&
      Math.round(element.getBoundingClientRect().left) === Number(left) &&
      Math.round(element.getBoundingClientRect().top + scrollY) === Number(top)
  );
  match?.focus();
};

const clipShot = async (
  page: PwPage,
  clip: { height: number; width: number; x: number; y: number }
): Promise<string> => {
  const buffer = await page.screenshot({ clip });
  return buffer.toString("base64");
};

const focusWalk = async (
  target: Page
): Promise<{ part: Result; stops: number }> => {
  const part = newResult("focus");
  const say = reporter(part, target.path);
  const stops = await withPage(
    { reducedMotion: "reduce", size: sizes.laptop, url: target.url },
    1500,
    async ({ page }) => {
      const seen = new Set<string>();
      for (let step = 0; step < 60; step += 1) {
        await page.keyboard.press("Tab");
        await page.waitForTimeout(120);
        const info = await page.evaluate(readFocus);
        if (!info || seen.has(info.key)) break;
        seen.add(info.key);
        if (!info.onScreen) {
          say.warn(`focused element is off screen: ${info.label}`);
          continue;
        }
        const viewport = page.viewportSize() ?? sizes.laptop.viewport;
        const x = Math.max(0, Math.floor(info.box.x - 8));
        const y = Math.max(0, Math.floor(info.box.y - 8));
        const clip = {
          height: Math.min(
            viewport.height - y,
            Math.ceil(info.box.height + 16)
          ),
          width: Math.min(viewport.width - x, Math.ceil(info.box.width + 16)),
          x,
          y,
        };
        if (clip.width < 2 || clip.height < 2) continue;
        const focused = await clipShot(page, clip);
        await page.evaluate(blurFocus);
        await page.waitForTimeout(150);
        const blurred = await clipShot(page, clip);
        await page.evaluate(refocus, info.key);
        await page.waitForTimeout(100);
        const { changed } = await pixelDiff(page, focused, blurred);
        if (changed < 12) say.warn(`no visible focus change on ${info.label}`);
        if (info.obscured)
          say.warn(`focused ${info.label} is covered by another element`);
      }
      return seen.size;
    }
  );
  return { part, stops };
};

const check: Check = async (audit) => {
  const result = newResult("a11y");
  const sizeNames = audit.fast
    ? (["phone", "laptop"] as const)
    : (["phone", "laptop", "wide"] as const);
  const incomplete = new Map<string, number>();
  const walkPages = audit.pages.filter(
    (entry) =>
      entry.kind === "home" ||
      entry.kind === "blog" ||
      (!audit.fast && entry.kind === "post")
  );
  const jobs = audit.pages.flatMap((entry) =>
    sizeNames.map((name) => ({ entry, name }))
  );
  const walking = pool(walkPages, focusWalk);
  const scans = await pool(jobs, ({ entry, name }) =>
    withPage(
      { reducedMotion: "reduce", size: sizes[name], url: entry.url },
      1500,
      async ({ page }) => ({
        entry,
        found: await new AxeBuilder({ page }).withTags(tags).analyze(),
        name,
      })
    )
  );
  const walks = await walking;
  for (const { entry, found, name } of scans) {
    const say = reporter(result, `${entry.path} ${name}`);
    for (const violation of found.violations) {
      const targets = violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(" "))
        .join(", ");
      say.fail(
        `[${String(violation.impact)}] ${violation.id}: ${violation.help} (${String(violation.nodes.length)}x: ${targets})`
      );
    }
    for (const item of found.incomplete)
      incomplete.set(
        item.id,
        (incomplete.get(item.id) ?? 0) + item.nodes.length
      );
  }
  const violations = count(result, "fail");
  const say = reporter(result, "");
  for (const [id, nodes] of incomplete)
    say.info(
      `axe could not decide ${id} on ${String(nodes)} nodes (usually contrast over the sky; the contrast check measures that)`
    );
  let stops = 0;
  for (const walk of walks) {
    stops += walk.stops;
    merge(result, walk.part);
  }
  result.metrics["violations"] = violations;
  result.metrics["tab_stops"] = stops;
  result.summary = `axe on ${String(audit.pages.length)} pages x ${String(sizeNames.length)} sizes: ${String(violations)} violations; ${String(stops)} tab stops walked, ${String(count(result, "warn"))} focus warnings`;
  return result;
};

export default check;
