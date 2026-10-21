import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type Browser,
  type BrowserContext,
  chromium,
  type Page,
  type Response,
} from "playwright-core";

import type { Context, Level, Result, Page as SitePage } from "./types.ts";

import { weatherPresets } from "../../src/lib/weather.ts";

export const root = fileURLToPath(new URL("../..", import.meta.url));

const desktopUA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const mobileUA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";

export interface Size {
  readonly deviceScaleFactor?: number;
  readonly hasTouch?: boolean;
  readonly isMobile?: boolean;
  readonly viewport: { readonly height: number; readonly width: number };
}

export const sizes = {
  laptop: { viewport: { height: 900, width: 1440 } },
  phone: {
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
    viewport: { height: 844, width: 390 },
  },
  tablet: {
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    viewport: { height: 1024, width: 768 },
  },
  wide: { viewport: { height: 1080, width: 1920 } },
} as const satisfies Record<string, Size>;

export const skyTimes = {
  day: "2026-10-12T10:00:00Z",
  daymoon: "2026-10-18T15:00:00Z",
  dusk: "2026-10-12T16:05:00Z",
  fullmoon: "2026-10-25T22:00:00Z",
  night: "2026-10-12T21:00:00Z",
} as const;

export const weathers = Object.keys(weatherPresets);

const withAgent = (size: Size): Size & { userAgent: string } => ({
  userAgent: size.isMobile ? mobileUA : desktopUA,
  ...size,
});

const gpuArgs = ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"];

let browser: Promise<Browser> | undefined;

const getBrowser = (): Promise<Browser> => {
  browser ??= chromium.launch({ args: gpuArgs, channel: "chromium" });
  return browser;
};

export const closeBrowser = async (): Promise<void> => {
  const open = browser;
  browser = undefined;
  try {
    const instance = await open;
    await instance?.close();
  } catch (error) {
    process.stderr.write(`browser did not close: ${String(error)}\n`);
  }
};

export const chromePath = (): string => chromium.executablePath();

let workers = 4;
let active = 0;
const waiting: Array<() => void> = [];

export const setWorkers = (count: number): void => {
  workers = Math.max(1, count);
};

const slot = async <T>(job: () => Promise<T>): Promise<T> => {
  if (active < workers) active += 1;
  else
    await new Promise<void>((resolve) => {
      waiting.push(resolve);
    });
  try {
    return await job();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active -= 1;
  }
};

export const pool = <T, R>(
  items: readonly T[],
  job: (item: T, index: number) => Promise<R>
): Promise<R[]> =>
  Promise.all(items.map((item, index) => slot(() => job(item, index))));

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const median = (values: readonly number[]): number => {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const high = sorted[middle] ?? NaN;
  return sorted.length % 2 === 1
    ? high
    : ((sorted[middle - 1] ?? NaN) + high) / 2;
};

export const pageSlug = (url: string): string => {
  const trimmed = new URL(url).pathname.replaceAll(/^\/+|\/+$/gu, "");
  return trimmed ? trimmed.replaceAll(/[^\w-]+/gu, "-") : "home";
};

export const withQuery = (
  url: string,
  query: Record<string, string>
): string => {
  const next = new URL(url);
  for (const [key, value] of Object.entries(query))
    next.searchParams.set(key, value);
  return next.href;
};

export const toBase = (url: string, base: string): string => {
  const parsed = new URL(url, base);
  return new URL(parsed.pathname + parsed.search, base).href;
};

export const newResult = (name: string): Result => ({
  lines: [],
  metrics: {},
  name,
  status: "pass",
  summary: "",
});

const raise = (result: Result, level: string): void => {
  if (level === "fail" || (level === "warn" && result.status === "pass"))
    result.status = level;
};

export const note = (result: Result, level: Level, line: string): void => {
  result.lines.push(`${level.toUpperCase().padEnd(4)} ${line}`);
  raise(result, level);
};

export const merge = (result: Result, part: Pick<Result, "lines">): void => {
  for (const line of part.lines) {
    result.lines.push(line);
    raise(result, line.slice(0, 4).trim().toLowerCase());
  }
};

export const count = (result: Result, level: Level): number =>
  result.lines.filter((line) => line.startsWith(level.toUpperCase())).length;

export type Say = Record<Level, (line: string) => void>;

export const reporter = (result: Result, where: string): Say => {
  const at =
    (level: Level) =>
    (line: string): void => {
      note(result, level, where ? `${where}: ${line}` : line);
    };
  return { fail: at("fail"), info: at("info"), warn: at("warn") };
};

export const baselineMetrics = (
  context: Context,
  name: string
): Record<string, number | undefined> =>
  context.baseline?.results.find((result) => result.name === name)?.metrics ??
  {};

export const outDir = (context: Context, name: string): string => {
  const dir = path.join(context.out, name);
  mkdirSync(dir, { recursive: true });
  return dir;
};

export const pageOf = (
  pages: readonly SitePage[],
  kind: string
): SitePage | undefined => pages.find((page) => page.kind === kind);

export const firstPostOnly = (pages: readonly SitePage[]): SitePage[] => {
  const first = pageOf(pages, "post");
  return pages.filter((page) => page.kind !== "post" || page === first);
};

export const sitemapTags = (sitemap: string, tag: string): string[] =>
  sitemap
    .matchAll(/<(loc|lastmod)>([^<]+)</gu)
    .filter((match) => match[1] === tag)
    .map((match) => (match[2] ?? "").trim())
    .toArray();

export const skip = (name: string, why: string): Result => ({
  ...newResult(name),
  status: "skip",
  summary: why,
});

const seedRandom = (): void => {
  let state = 1_234_567;
  Math.random = () => {
    state = (state + 0x6d_2b_79_f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
};

export interface Opened {
  context: BrowserContext;
  errors: string[];
  page: Page;
  response: null | Response;
}

export interface OpenOptions {
  init?: () => void;
  js?: boolean;
  reducedMotion?: "no-preference" | "reduce";
  seed?: boolean;
  size?: Size;
  time?: string;
  url: string;
}

export const openPage = async ({
  init,
  js = true,
  reducedMotion = "no-preference",
  seed = false,
  size = sizes.laptop,
  time,
  url,
}: OpenOptions): Promise<Opened> => {
  const browserInstance = await getBrowser();
  const context = await browserInstance.newContext({
    ...withAgent(size),
    javaScriptEnabled: js,
    reducedMotion,
  });
  if (seed) await context.addInitScript(seedRandom);
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(`pageerror: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  if (time) await page.clock.setFixedTime(new Date(time));
  const response = await page.goto(url, {
    timeout: 60_000,
    waitUntil: "load",
  });
  return { context, errors, page, response };
};

const waitForAssets = async (): Promise<void> => {
  const images = Promise.all(
    [...document.images].map(async (image) => {
      if (image.complete) return;
      try {
        await image.decode();
      } catch {}
    })
  );
  await Promise.race([
    Promise.all([document.fonts.ready, images]),
    new Promise((resolve) => setTimeout(resolve, 4000)),
  ]);
};

const settle = async (page: Page, ms = 1200): Promise<void> => {
  await page.evaluate(waitForAssets);
  await page.waitForTimeout(ms);
};

export const withPage = async <T>(
  options: OpenOptions,
  wait: number,
  work: (opened: Opened) => Promise<T>
): Promise<T> => {
  const opened = await openPage(options);
  try {
    await settle(opened.page, wait);
    return await work(opened);
  } finally {
    await opened.context.close();
  }
};

export interface PixelDiff {
  changed: number;
  sameSize: boolean;
  total: number;
}

const countChanged = async (input: {
  other: string;
  shown: string;
}): Promise<PixelDiff> => {
  const [a, b] = await Promise.all(
    [input.shown, input.other].map(async (source) => {
      const image = new Image();
      image.src = `data:image/png;base64,${source}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("no 2d canvas");
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height);
    })
  );
  if (!a || !b) throw new Error("no images");
  let changed = 0;
  for (
    let index = 0;
    index < Math.min(a.data.length, b.data.length);
    index += 4
  ) {
    let delta = 0;
    for (let channel = 0; channel < 3; channel += 1)
      delta = Math.max(
        delta,
        Math.abs(
          (a.data[index + channel] ?? 0) - (b.data[index + channel] ?? 0)
        )
      );
    if (delta > 40) changed += 1;
  }
  return {
    changed,
    sameSize: a.width === b.width && a.height === b.height,
    total: a.width * a.height,
  };
};

export const pixelDiff = (
  page: Page,
  shown: string,
  other: string
): Promise<PixelDiff> => page.evaluate(countChanged, { other, shown });

export interface Fetched {
  body: string;
  headers: Headers;
  status: number;
}

export const fetchText = async (
  url: string,
  init: RequestInit = {}
): Promise<Fetched> => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
        ...init,
      });
      return {
        body: await response.text(),
        headers: response.headers,
        status: response.status,
      };
    } catch (error) {
      if (attempt >= 3) throw error;
      await sleep(500 * attempt);
    }
  }
};
