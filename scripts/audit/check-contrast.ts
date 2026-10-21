import fs from "node:fs";
import path from "node:path";
import { type Page as PwPage } from "playwright-core";

import type { Check, Context, Page } from "./types.ts";

import {
  contrast,
  type InkTarget,
  inkTargets,
  luminance,
  postInkTargets,
} from "../../src/lib/sky-ink.ts";
import {
  newResult,
  note,
  outDir,
  pageOf,
  pageSlug,
  pool,
  type Size,
  sizes,
  skyTimes,
  weathers,
  withPage,
  withQuery,
} from "./lib.ts";

interface AnalyseInput {
  boxes: Rect[];
  dpr: number;
  hidden: string;
  shown: string;
}
interface Found {
  box: Rect;
  color: number[];
  dark: boolean;
  index: number;
  lift: string;
  paint: string;
}

interface LiveItem extends Found {
  target: InkTarget;
}

interface Measured {
  glyphRing: number;
  ring02: number;
  ring98: number;
}

interface Plan {
  page: Page;
  sizes: Array<[SizeName, Spot[]]>;
  states: readonly string[];
  targets: readonly InkTarget[];
  times: Time[];
}

interface Rect {
  h: number;
  w: number;
  x: number;
  y: number;
}

interface Row {
  key: string;
  lift: number;
  need: number;
  page: string;
  ratio: number;
  ring: number;
  size: string;
  spot: string;
  state: string;
  time: string;
}

type SizeName = keyof typeof sizes;

type Spot = "end" | "mid" | "top";

type Time = keyof typeof skyTimes;

const keyOf = (target: InkTarget): string => {
  const last = target.paint.split(/\s+/u).at(-1) ?? target.paint;
  return `${last.replace(/^\./u, "")}${target.index ? String(target.index) : ""}`;
};

const snapshot = async (page: PwPage): Promise<string> => {
  const buffer = await page.screenshot();
  return buffer.toString("base64");
};

const detach = (node: Element): void => {
  node.remove();
};

const holdSky = (held: boolean): void => {
  document.documentElement.toggleAttribute("data-motion-paused", held);
  dispatchEvent(new Event("scene:hold"));
};

const glyphCss = (paints: readonly string[]): string => {
  const pill = ":is(.sky-trigger, .sky-trigger *)";
  const inner = paints.flatMap((selector) =>
    ["", "::before", "::after"].map(
      (part) => `${selector} *:not(${pill})${part}`
    )
  );
  const fill = `${[...paints, ...inner].join(",")}{-webkit-text-fill-color:transparent!important;text-decoration-color:transparent!important;background-image:none!important;transition:none!important;animation:none!important}`;
  const keep = `${paints.map((selector) => `${selector} ${pill}`).join(",")}{-webkit-text-fill-color:currentColor!important}`;
  return fill + keep;
};

const scrollSpot = (spot: Spot): void => {
  const max = document.documentElement.scrollHeight - innerHeight;
  const half = max / 2;
  const tops = { end: max, mid: half, top: 0 };
  scrollTo({ behavior: "instant", top: tops[spot] });
};

const findTargets = (
  targets: Array<{ index: number; paint: string; probe: string }>
): Array<Found | null> =>
  targets.map((target) => {
    const node = document.querySelectorAll(target.paint)[target.index];
    const probe = document.querySelectorAll(target.probe)[target.index];
    if (!node || !probe) return null;
    const range = document.createRange();
    range.selectNodeContents(probe);
    const bounds = range.getBoundingClientRect();
    if (bounds.width < 1 || bounds.bottom < 0 || bounds.top > innerHeight)
      return null;
    const style = getComputedStyle(node);
    const numbers = (style.color.match(/[\d.]+/gu) ?? [])
      .slice(0, 3)
      .map(Number);
    return {
      box: {
        h: bounds.height + 6,
        w: bounds.width + 6,
        x: bounds.left - 3,
        y: bounds.top - 3,
      },
      color: style.color.startsWith("color(")
        ? numbers.map((value) => value * 255)
        : numbers,
      dark: node instanceof HTMLElement && node.dataset["ink"] === "dark",
      index: target.index,
      lift: style.getPropertyValue("--lift").trim(),
      paint: target.paint,
    };
  });

const analyse = async ({
  boxes,
  dpr,
  hidden,
  shown,
}: AnalyseInput): Promise<Array<Measured | null>> => {
  const knee = 0.04045;
  const gamma = 2.4;
  const linear = (value: number): number => {
    const share = value / 255;
    return share <= knee ? share / 12.92 : ((share + 0.055) / 1.055) ** gamma;
  };
  const lum = (data: Uint8ClampedArray, index: number): number =>
    0.2126 * linear(data[index] ?? 0) +
    0.7152 * linear(data[index + 1] ?? 0) +
    0.0722 * linear(data[index + 2] ?? 0);
  const [a, b] = await Promise.all(
    [shown, hidden].map(async (source) => {
      const image = new Image();
      image.src = `data:image/png;base64,${source}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("no 2d canvas");
      context.drawImage(image, 0, 0);
      return {
        data: context.getImageData(0, 0, canvas.width, canvas.height).data,
        height: canvas.height,
        width: canvas.width,
      };
    })
  );
  if (!a || !b) throw new Error("no images");
  const reach = Math.max(1, Math.round(dpr * 1.5));
  return boxes.map((box) => {
    const x0 = Math.max(0, Math.floor(box.x * dpr));
    const y0 = Math.max(0, Math.floor(box.y * dpr));
    const x1 = Math.min(a.width, Math.ceil((box.x + box.w) * dpr));
    const y1 = Math.min(a.height, Math.ceil((box.y + box.h) * dpr));
    if (x1 - x0 < 2 || y1 - y0 < 2) return null;
    const width = x1 - x0;
    const height = y1 - y0;
    const mask = new Uint8Array(width * height);
    for (let y = y0; y < y1; y += 1)
      for (let x = x0; x < x1; x += 1) {
        const index = (y * a.width + x) * 4;
        if (Math.abs(lum(a.data, index) - lum(b.data, index)) > 0.05)
          mask[(y - y0) * width + (x - x0)] = 1;
      }
    const nearGlyph = (x: number, y: number): boolean => {
      for (let dy = -reach; dy <= reach; dy += 1)
        for (let dx = -reach; dx <= reach; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (
            nx >= 0 &&
            nx < width &&
            ny >= 0 &&
            ny < height &&
            mask[ny * width + nx] === 1
          )
            return true;
        }
      return false;
    };
    const ring: number[] = [];
    for (let y = 0; y < height; y += 1)
      for (let x = 0; x < width; x += 1)
        if (mask[y * width + x] === 0 && nearGlyph(x, y))
          ring.push(lum(b.data, ((y + y0) * a.width + x + x0) * 4));
    const sorted = ring.toSorted((p, q) => p - q);
    const share = (part: number): number =>
      sorted[Math.min(sorted.length - 1, Math.floor(part * sorted.length))] ??
      0;
    return {
      glyphRing: sorted.length,
      ring02: share(0.02),
      ring98: share(0.98),
    };
  });
};

const plansFor = (audit: Context): Plan[] => {
  const home = pageOf(audit.pages, "home");
  const post = pageOf(audit.pages, "post");
  const plans: Plan[] = [];
  if (home)
    plans.push(
      audit.fast
        ? {
            page: home,
            sizes: [
              ["phone", ["top"]],
              ["laptop", ["top"]],
            ],
            states: ["partly", "snow", "fog"],
            targets: inkTargets,
            times: ["day", "night"],
          }
        : {
            page: home,
            sizes: [
              ["phone", ["top", "mid", "end"]],
              ["laptop", ["top"]],
              ["wide", ["top"]],
            ],
            states: weathers,
            targets: inkTargets,
            times: ["day", "daymoon", "dusk", "night", "fullmoon"],
          }
    );
  if (post)
    plans.push({
      page: post,
      sizes: [
        ["phone", audit.fast ? ["top"] : ["top", "end"]],
        ["laptop", ["top"]],
      ],
      states: ["partly"],
      targets: postInkTargets,
      times: ["day"],
    });
  return plans;
};

const check: Check = async (audit) => {
  const result = newResult("contrast");
  const dir = outDir(audit, "contrast");
  const rows: Row[] = [];
  const worst = new Map<string, Row>();
  const jobs: Array<{
    plan: Plan;
    sizeName: SizeName;
    spots: Spot[];
    state: string;
    time: Time;
  }> = [];
  for (const plan of plansFor(audit))
    for (const time of plan.times)
      for (const [sizeName, spots] of plan.sizes)
        for (const state of plan.states)
          jobs.push({ plan, sizeName, spots, state, time });
  const runs = await pool(
    jobs,
    async ({ plan, sizeName, spots, state, time }) => {
      const slug = pageSlug(plan.page.url);
      const paints = [...new Set(plan.targets.map((target) => target.paint))];
      const hideCss = glyphCss(paints);
      const wanted = plan.targets.map(({ index, paint, probe }) => ({
        index,
        paint,
        probe,
      }));
      const size: Size = sizes[sizeName];
      return withPage(
        {
          size,
          time: skyTimes[time],
          url: withQuery(plan.page.url, { weather: state }),
        },
        3000,
        async ({ page }) => {
          const found: Array<{ row: Row; slug: string }> = [];
          for (const spot of spots) {
            await page.evaluate(scrollSpot, spot);
            await page.waitForTimeout(spot === "top" ? 600 : 2200);
            await page.evaluate(holdSky, true);
            await page.waitForTimeout(250);
            const items = await page.evaluate(findTargets, wanted);
            const shown = await snapshot(page);
            const tag = await page.addStyleTag({ content: hideCss });
            await page.waitForTimeout(80);
            const hidden = await snapshot(page);
            await tag.evaluate(detach);
            const live: LiveItem[] = [];
            for (const [index, item] of items.entries()) {
              const target = plan.targets[index];
              if (item && target) live.push({ ...item, target });
            }
            const measured = await page.evaluate(analyse, {
              boxes: live.map((item) => item.box),
              dpr: size.deviceScaleFactor ?? 1,
              hidden,
              shown,
            });
            let failed = false;
            for (const [index, item] of live.entries()) {
              const reading = measured[index];
              if (!reading?.glyphRing) continue;
              const [red = 0, green = 0, blue = 0] = item.color;
              const ring = item.dark ? reading.ring02 : reading.ring98;
              const ratio = contrast(luminance(red, green, blue), ring);
              found.push({
                row: {
                  key: keyOf(item.target),
                  lift: Number(item.lift || 0),
                  need: item.target.need,
                  page: plan.page.path,
                  ratio,
                  ring,
                  size: sizeName,
                  spot,
                  state,
                  time,
                },
                slug,
              });
              if (ratio < item.target.need) failed = true;
            }
            if (failed)
              await page.screenshot({
                path: path.join(
                  dir,
                  `${slug}-${sizeName}-${time}-${state}-${spot}.png`
                ),
              });
            await page.evaluate(holdSky, false);
          }
          return found;
        }
      );
    }
  );
  for (const { row, slug } of runs.flat()) {
    rows.push(row);
    const key = `${slug} ${row.size} ${row.key}`;
    const seen = worst.get(key);
    if (!seen || row.ratio < seen.ratio) worst.set(key, row);
    if (row.ratio < row.need)
      note(
        result,
        "fail",
        `${row.page} ${row.key}: ${row.ratio.toFixed(2)} < ${String(row.need)} at ${row.time} ${row.size} ${row.state} ${row.spot} (lift ${String(row.lift)})`
      );
  }
  fs.writeFileSync(path.join(dir, "rows.json"), JSON.stringify(rows, null, 1));
  const ordered = worst
    .entries()
    .toArray()
    .toSorted(([a], [b]) => a.localeCompare(b));
  for (const [key, row] of ordered) {
    result.metrics[`worst_${key.replaceAll(" ", "_")}`] = Number(
      row.ratio.toFixed(2)
    );
    note(
      result,
      "info",
      `worst ${key.padEnd(34)} ${row.ratio.toFixed(2)} (need ${String(row.need)}) at ${row.time} ${row.state} ${row.spot}`
    );
  }
  const fails = rows.filter((row) => row.ratio < row.need).length;
  const low = worst
    .values()
    .toArray()
    .toSorted((a, b) => a.ratio / a.need - b.ratio / b.need)[0];
  result.metrics["fails"] = fails;
  const closest = low
    ? `; closest: ${low.page} ${low.key} ${low.ratio.toFixed(2)} vs ${String(low.need)}`
    : "";
  result.summary = `${String(jobs.length)} sky looks, ${String(rows.length)} text readings: ${String(fails)} under target${closest}`;
  return result;
};

export default check;
