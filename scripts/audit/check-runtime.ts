import type { Check, Page } from "./types.ts";

import {
  count,
  newResult,
  openPage,
  pageSlug,
  pool,
  reporter,
  sizes,
} from "./lib.ts";

interface Audit {
  csp: string[];
  shifts: number[];
}

interface Run {
  errors: string[];
  failed: string[];
  page: Page;
  seen: Audit;
  sizeName: SizeName;
}

type SizeName = "laptop" | "phone";

const sizeNames: SizeName[] = ["laptop", "phone"];

const watch = (): void => {
  const audit: Audit = { csp: [], shifts: [] };
  Object.defineProperty(globalThis, "__audit", { value: audit });
  document.addEventListener("securitypolicyviolation", (event) => {
    audit.csp.push(`${event.violatedDirective} ${event.blockedURI}`);
  });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const shift = entry as PerformanceEntry & {
        hadRecentInput: boolean;
        value: number;
      };
      if (!shift.hadRecentInput) audit.shifts.push(shift.value);
    }
  }).observe({ buffered: true, type: "layout-shift" });
};

const readAudit = (): unknown =>
  (globalThis as unknown as Record<string, unknown>)["__audit"];

const isAudit = (value: unknown): value is Audit =>
  typeof value === "object" &&
  value !== null &&
  "csp" in value &&
  "shifts" in value;

const visit = async (
  page: Page,
  sizeName: SizeName,
  wait: number
): Promise<Run> => {
  const failed: string[] = [];
  const opened = await openPage({
    init: watch,
    size: sizes[sizeName],
    url: "about:blank",
  });
  opened.page.on("response", (response) => {
    if (
      response.status() >= 400 &&
      !(page.kind === "404" && response.url() === page.url)
    )
      failed.push(`${String(response.status())} ${response.url()}`);
  });
  opened.page.on("requestfailed", (request) => {
    const why = request.failure()?.errorText ?? "";
    if (!why.includes("ERR_ABORTED")) failed.push(`${why} ${request.url()}`);
  });
  await opened.page.goto(page.url, { waitUntil: "load" });
  await opened.page.waitForTimeout(wait);
  const raw = await opened.page.evaluate(readAudit);
  await opened.context.close();
  const seen = isAudit(raw) ? raw : { csp: [], shifts: [] };
  return { errors: opened.errors, failed, page, seen, sizeName };
};

const check: Check = async (context) => {
  const result = newResult("runtime");
  const wait = context.fast ? 3000 : 5000;
  let worst = 0;
  const jobs = context.pages.flatMap((page) =>
    sizeNames.map((sizeName) => ({ page, sizeName }))
  );
  const runs = await pool(jobs, (job) => visit(job.page, job.sizeName, wait));
  for (const { errors, failed, page, seen, sizeName } of runs) {
    const say = reporter(result, `${page.path} ${sizeName}`);
    for (const error of errors)
      if (!(page.kind === "404" && error.includes("status of 404")))
        say.fail(error);
    for (const blocked of seen.csp) say.fail(`CSP blocked ${blocked}`);
    for (const request of failed) say.fail(`request failed ${request}`);
    const cls = seen.shifts.reduce((sum, shift) => sum + shift, 0);
    worst = Math.max(worst, cls);
    result.metrics[`cls_${pageSlug(page.url)}_${sizeName}`] = Number(
      cls.toFixed(4)
    );
    if (cls > 0.25) say.fail(`layout shift ${cls.toFixed(3)} (over 0.25)`);
    else if (cls > 0.1) say.warn(`layout shift ${cls.toFixed(3)} (over 0.1)`);
  }
  const fails = count(result, "fail");
  result.summary = `${String(context.pages.length)} pages x 2 sizes: ${String(fails)} errors, worst layout shift ${worst.toFixed(3)} (unthrottled)`;
  return result;
};

export default check;
