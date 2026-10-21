import fs from "node:fs";
import path from "node:path";

import type { Check, Page } from "./types.ts";

import {
  newResult,
  note,
  openPage,
  pageSlug,
  pixelDiff,
  pool,
  settle,
  type Size,
  skyTimes,
  withQuery,
} from "./lib.ts";

const shotSizes: Record<"laptop" | "phone" | "tablet", Size> = {
  laptop: { viewport: { height: 900, width: 1440 } },
  phone: {
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    viewport: { height: 844, width: 390 },
  },
  tablet: {
    hasTouch: true,
    isMobile: true,
    viewport: { height: 1024, width: 768 },
  },
};

interface Job {
  entry: Page;
  size: ShotSize;
  time: "day" | "night";
  weather: string;
}

type ShotSize = keyof typeof shotSizes;

const isTall = (): boolean =>
  document.documentElement.scrollHeight > innerHeight + 40;

const scrollToEnd = (): void => {
  scrollTo({ behavior: "instant", top: document.documentElement.scrollHeight });
};

const check: Check = async (audit) => {
  const result = newResult("shots");
  const dir = path.join(audit.out, "shots");
  fs.mkdirSync(dir, { recursive: true });
  const firstPost = audit.pages.find((entry) => entry.kind === "post");
  const pages = audit.pages.filter(
    (entry) => entry.kind !== "post" || entry === firstPost
  );
  const looks: ReadonlyArray<readonly ["day" | "night", string]> = audit.fast
    ? [["day", "partly"]]
    : [
        ["day", "partly"],
        ["night", "clear"],
      ];
  const sizeNames: readonly ShotSize[] = audit.fast
    ? ["phone", "laptop"]
    : ["phone", "tablet", "laptop"];
  const jobs: Job[] = [];
  for (const entry of pages)
    for (const size of sizeNames)
      for (const [time, weather] of looks)
        jobs.push({ entry, size, time, weather });
  const taken = await pool(jobs, async ({ entry, size, time, weather }) => {
    const { context, page } = await openPage({
      reducedMotion: "reduce",
      seed: true,
      size: shotSizes[size],
      time: skyTimes[time],
      url: withQuery(entry.url, { weather }),
    });
    await settle(page, 2500);
    const base = `${pageSlug(entry.url)}-${size}-${time}`;
    const made = [`${base}.png`];
    await page.screenshot({ path: path.join(dir, `${base}.png`) });
    if (await page.evaluate(isTall)) {
      await page.evaluate(scrollToEnd);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(dir, `${base}-end.png`) });
      made.push(`${base}-end.png`);
    }
    await context.close();
    return made;
  });
  const names = taken.flat();
  result.metrics["shots"] = names.length;
  const before = audit.baselineDir
    ? path.join(audit.baselineDir, "shots")
    : undefined;
  if (!before || !fs.existsSync(before)) {
    result.summary = `${String(names.length)} screenshots in shots/ (no baseline to compare)`;
    return result;
  }
  const { context, page } = await openPage({ url: "about:blank" });
  const changes: Array<[string, number | undefined]> = [];
  for (const name of names) {
    const old = path.join(before, name);
    if (!fs.existsSync(old)) {
      changes.push([name, undefined]);
      continue;
    }
    const shown = fs.readFileSync(path.join(dir, name)).toString("base64");
    const other = fs.readFileSync(old).toString("base64");
    const { changed, sameSize, total } = await pixelDiff(page, shown, other);
    changes.push([name, sameSize ? (changed / total) * 100 : 100]);
  }
  await context.close();
  const ordered = changes.toSorted((a, b) => (b[1] ?? 101) - (a[1] ?? 101));
  for (const [name, percent] of ordered)
    note(
      result,
      "info",
      percent === undefined
        ? `${name}: new (no baseline shot)`
        : `${name}: ${percent.toFixed(2)}% of pixels changed`
    );
  const moved = changes.filter(
    ([, percent]) => percent === undefined || percent > 0.5
  ).length;
  result.summary = `${String(names.length)} screenshots in shots/, ${String(moved)} differ from the baseline by more than 0.5% (no diff images)`;
  return result;
};

export default check;
