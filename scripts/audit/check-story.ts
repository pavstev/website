import { AxeBuilder } from "@axe-core/playwright";

import type { Check, Page, Result } from "./types.ts";

import {
  merge,
  newResult,
  pageOf,
  pool,
  reporter,
  type Say,
  type Size,
  skyTimes,
  withPage,
  withQuery,
} from "./lib.ts";

export interface Box {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

const filled = (box: Box): boolean =>
  box.right > box.left && box.bottom > box.top;

export const rectsOverlap = (a: Box, b: Box): boolean =>
  filled(a) &&
  filled(b) &&
  a.left < b.right &&
  b.left < a.right &&
  a.top < b.bottom &&
  b.top < a.bottom;

export const inside = (inner: Box, outer: Box, slack = 1): boolean =>
  inner.left >= outer.left - slack &&
  inner.top >= outer.top - slack &&
  inner.right <= outer.right + slack &&
  inner.bottom <= outer.bottom + slack;

type Mode = "early" | "late" | "read";

interface Snapshot {
  canvas: Box;
  covered: string[];
  current: string;
  pins: Array<{ box: Box; text: string }>;
  poster: boolean;
  scrollWidth: number;
  stage: Box;
  strips: Array<{ box: Box; id: string }>;
  texts: Array<{ box: Box; name: string }>;
  viewport: Box;
  wide: boolean;
}

interface Viewport {
  height: number;
  name: string;
  touch: boolean;
  width: number;
  zoom: boolean;
}

const viewports: readonly Viewport[] = [
  { height: 568, name: "320", touch: true, width: 320, zoom: false },
  { height: 844, name: "390", touch: true, width: 390, zoom: false },
  { height: 1024, name: "768", touch: true, width: 768, zoom: false },
  { height: 768, name: "1024", touch: false, width: 1024, zoom: false },
  { height: 900, name: "1440", touch: false, width: 1440, zoom: false },
  { height: 844, name: "390 at 200%", touch: true, width: 390, zoom: true },
];

const modes: readonly Mode[] = ["early", "read", "late"];
const tags = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
  "best-practice",
];

const noWebgl = (): void => {
  const proto = HTMLCanvasElement.prototype;
  const original: unknown = Object.getOwnPropertyDescriptor(
    proto,
    "getContext"
  )?.value;
  if (typeof original !== "function") return;
  const patched = function patched(
    this: HTMLCanvasElement,
    kind: string,
    options?: unknown
  ): null | RenderingContext {
    return kind === "webgl2"
      ? null
      : (Reflect.apply(original, this, [
          kind,
          options,
        ]) as null | RenderingContext);
  };
  Object.defineProperty(proto, "getContext", { value: patched });
};

const place = ({ id, mode }: { id: string; mode: Mode }): void => {
  const item = document.querySelector<HTMLElement>(
    `.story-step[data-step="${CSS.escape(id)}"]`
  );
  const stage = document.querySelector<HTMLElement>("[data-story-stage]");
  const body = item?.querySelector<HTMLElement>(".story-body");
  if (!item || !stage || !body) throw new Error(`no step ${id}`);
  const readGap =
    (document.querySelector<HTMLElement>("[data-blog-bar]")?.offsetHeight ??
      0) + 8;
  const itemTop = item.getBoundingClientRect().top + scrollY;
  const share = mode === "early" ? 0.05 : 0.95;
  const top =
    mode === "read"
      ? Math.min(
          itemTop + item.offsetHeight - innerHeight,
          body.getBoundingClientRect().top + scrollY - readGap
        )
      : itemTop + share * item.offsetHeight;
  scrollTo({ behavior: "instant", top });
};

const snapshot = ({ id, mode }: { id: string; mode: Mode }): Snapshot => {
  const tenth = 10;
  const rect = (source: { getBoundingClientRect(): DOMRect }): Box => {
    const r = source.getBoundingClientRect();
    return {
      bottom: Math.round(r.bottom * tenth) / tenth,
      left: Math.round(r.left * tenth) / tenth,
      right: Math.round(r.right * tenth) / tenth,
      top: Math.round(r.top * tenth) / tenth,
    };
  };
  const wide = matchMedia("(min-width: 48em)").matches;
  const item = document.querySelector<HTMLElement>(
    `.story-step[data-step="${CSS.escape(id)}"]`
  );
  const stage = document.querySelector<HTMLElement>("[data-story-stage]");
  const canvas = document.querySelector<HTMLElement>("canvas.story-canvas");
  const root = document.querySelector<HTMLElement>("[data-story-root]");
  if (!item || !stage || !canvas || !root) throw new Error("no story DOM");
  const viewport = {
    bottom: innerHeight,
    left: 0,
    right: innerWidth,
    top: 0,
  };
  const textOf = (el: Element): Box => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return rect(range);
  };
  const parts = [
    ...item.querySelectorAll<HTMLElement>(
      ":scope .story-eyebrow, :scope .story-line, :scope .story-note, :scope .story-number, :scope .story-outro > *"
    ),
  ];
  const found = item.querySelector<HTMLElement>(".story-strip");
  const strip =
    found && found.getBoundingClientRect().width > 2 ? found : undefined;
  const texts = [
    ...parts.map((el) => ({
      box: textOf(el),
      name: el.className.split(" ", 1)[0] ?? el.tagName,
    })),
    ...(strip ? [{ box: rect(strip), name: "story-strip" }] : []),
  ];
  const covered: string[] = [];
  const readable = mode === "read" ? [...parts, ...(strip ? [strip] : [])] : [];
  for (const el of readable) {
    const box = el === strip ? rect(el) : textOf(el);
    const x = (box.left + box.right) / 2;
    const y = (box.top + box.bottom) / 2;
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
    const hit = document.elementFromPoint(x, y);
    if (hit && !el.contains(hit) && !hit.contains(el))
      covered.push(
        `${el.className.split(" ", 1)[0] ?? el.tagName} under ${hit.tagName.toLowerCase()}.${hit.className}`
      );
  }
  const posters = [
    ...document.querySelectorAll<SVGElement>(".story-poster"),
  ].filter(
    (poster) =>
      getComputedStyle(poster).display !== "none" &&
      poster.getBoundingClientRect().width > 0
  );
  return {
    canvas: rect(canvas),
    covered,
    current: root.dataset["storyStep"] ?? "",
    pins: [
      ...document.querySelectorAll(".story-labels > :not(svg)"),
      ...posters.flatMap((poster) => [...poster.querySelectorAll("text")]),
    ]
      .filter((pin) => Number(getComputedStyle(pin).opacity) > 0.05)
      .map((pin) => ({ box: rect(pin), text: pin.textContent ?? "" })),
    poster: posters.length > 0,
    scrollWidth: document.documentElement.scrollWidth,
    stage: rect(stage),
    strips: [...document.querySelectorAll<HTMLElement>(".story-strip")]
      .filter((el) => el.getBoundingClientRect().width > 2)
      .map((el) => ({
        box: rect(el),
        id: el.closest<HTMLElement>(".story-step")?.dataset["step"] ?? "",
      })),
    texts,
    viewport,
    wide,
  };
};

const stepIds = (): string[] =>
  [...document.querySelectorAll<HTMLElement>(".story-step[data-step]")].map(
    (el) => el.dataset["step"] ?? ""
  );

const toTop = (): void => {
  scrollTo({ behavior: "instant", top: 0 });
};

const isLive = (): boolean =>
  document.querySelector<HTMLElement>("[data-story-root]")?.dataset[
    "storyState"
  ] === "live";

const zoomText = (): void => {
  document.documentElement.style.fontSize = "200%";
};

const rounded = (box: Box): string =>
  `${String(Math.round(box.left))},${String(Math.round(box.top))}..${String(Math.round(box.right))},${String(Math.round(box.bottom))}`;

const judge = (
  shot: Snapshot,
  id: string,
  mode: Mode,
  live: boolean
): string[] => {
  const found: string[] = [];
  if (shot.scrollWidth > shot.viewport.right + 1)
    found.push(
      `page scrolls sideways by ${String(shot.scrollWidth - shot.viewport.right)}px`
    );
  if (!rectsOverlap(shot.stage, shot.viewport))
    found.push(`stage is out of the viewport ${rounded(shot.stage)}`);
  for (const pin of shot.pins) {
    if (!inside(pin.box, shot.canvas))
      found.push(
        `pin "${pin.text}" ${rounded(pin.box)} leaves the canvas ${rounded(shot.canvas)}`
      );
    for (const text of shot.texts)
      if (rectsOverlap(pin.box, text.box))
        found.push(
          `pin "${pin.text}" ${rounded(pin.box)} overlaps ${text.name} ${rounded(text.box)}`
        );
  }
  for (const text of shot.texts)
    for (const strip of shot.strips)
      if (strip.id !== id && rectsOverlap(text.box, strip.box))
        found.push(
          `${text.name} overlaps the strip of ${strip.id} ${rounded(strip.box)}`
        );
  for (const line of shot.covered) found.push(`covered: ${line}`);
  if (live && mode !== "read" && shot.current !== id)
    found.push(`current step is "${shot.current}"`);
  if (!live && !shot.poster) found.push("no poster is shown");
  return found;
};

const report = (say: Say, found: readonly string[]): void => {
  const unique = [...new Set(found)];
  for (const line of unique.slice(0, 6)) say.fail(line);
  if (unique.length > 6) say.fail(`${String(unique.length - 6)} more findings`);
};

const toSize = (view: Viewport): Size => ({
  deviceScaleFactor: 1,
  hasTouch: view.touch,
  isMobile: view.touch,
  viewport: { height: view.height, width: view.width },
});

const runCase = async (
  entry: Page,
  view: Viewport,
  live: boolean
): Promise<Result> => {
  const label = `${view.name} ${live ? "live" : "poster"}`;
  const part = newResult(label);
  const say = reporter(part, label);
  await withPage(
    {
      ...(!live && { init: noWebgl }),
      reducedMotion: "no-preference",
      size: toSize(view),
      url: entry.url,
    },
    1200,
    async ({ errors, page }) => {
      if (view.zoom) {
        await page.evaluate(zoomText);
        await page.waitForTimeout(700);
      }
      if (live) {
        try {
          await page.waitForFunction(isLive, null, { timeout: 8000 });
        } catch {
          say.fail("the live drawing never started (data-story-state)");
        }
      } else if (await page.locator("[data-story-state]").count())
        say.fail("the poster path started the live drawing");
      const ids = await page.evaluate(stepIds);
      if (ids.length === 0) say.fail("no steps found");
      const wait = live ? 700 : 150;
      for (const id of ids)
        for (const mode of modes) {
          await page.evaluate(place, { id, mode });
          await page.waitForTimeout(wait);
          const shot = await page.evaluate(snapshot, { id, mode });
          report(
            reporter(part, `${label} ${id} ${mode}`),
            judge(shot, id, mode, live)
          );
        }
      await page.evaluate(toTop);
      const axe = await new AxeBuilder({ page }).withTags(tags).analyze();
      for (const violation of axe.violations) {
        const targets = violation.nodes
          .slice(0, 3)
          .map((node) => node.target.join(" "))
          .join(", ");
        say.fail(
          `axe [${String(violation.impact)}] ${violation.id}: ${violation.help} (${String(violation.nodes.length)}x: ${targets})`
        );
      }
      for (const error of errors) say.fail(error);
    }
  );
  if (part.status === "pass")
    say.info("pass: no overflow, labels and text apart, axe 0, console clean");
  return part;
};

const runEntry = async (base: string): Promise<Result> => {
  const part = newResult("entry");
  const say = reporter(part, "entry");
  await withPage(
    {
      size: toSize({
        height: 900,
        name: "1440",
        touch: false,
        width: 1440,
        zoom: false,
      }),
      url: withQuery(`${base}/work`, { at: skyTimes.night }),
    },
    1500,
    async ({ errors, page }) => {
      const sky = page.locator("canvas[data-space]");
      if ((await sky.count()) === 0) say.fail("/work has no sky canvas");
      await page.locator("a[data-story-link]").first().click();
      try {
        await page.waitForURL("**/work/dotfiles", { timeout: 15_000 });
      } catch {
        say.fail(`the URL is ${page.url()}, not /work/dotfiles`);
      }
      await page.waitForSelector("[data-story-root]", { timeout: 10_000 });
      await page.waitForTimeout(1200);
      if ((await sky.count()) > 0) say.fail("the story page has a sky canvas");
      await page.goBack();
      try {
        await page.waitForSelector("canvas[data-space]", { timeout: 15_000 });
      } catch {
        say.fail("back on /work the sky canvas did not return");
      }
      if (!page.url().includes("/work") || page.url().includes("dotfiles"))
        say.fail(`back landed on ${page.url()}`);
      for (const error of errors) say.fail(error);
    }
  );
  if (part.status === "pass")
    say.info("pass: link, URL, no sky on the story, back, sky returns");
  return part;
};

const check: Check = async (audit) => {
  const result = newResult("story");
  const entry = pageOf(audit.pages, "story");
  if (!entry) {
    reporter(result, "").fail("no story page in the sitemap");
    result.summary = "no story page";
    return result;
  }
  const jobs = viewports.flatMap((view) => [
    { live: true, view },
    { live: false, view },
  ]);
  const parts = await pool(jobs, ({ live, view }) =>
    runCase(entry, view, live)
  );
  parts.push(await runEntry(audit.base));
  let failures = 0;
  for (const part of parts) {
    merge(result, part);
    failures += part.lines.filter((line) => line.startsWith("FAIL")).length;
  }
  result.metrics["cases"] = jobs.length;
  result.metrics["failures"] = failures;
  result.summary = `${String(jobs.length)} width x path runs (live and poster, ${String(modes.length)} scroll positions per step) plus the entry flow: ${String(failures)} failures`;
  return result;
};

export default check;
