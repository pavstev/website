import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { Check, Page } from "./types.ts";

import {
  chromePath,
  median,
  newResult,
  note,
  pageSlug,
  root,
  skip,
} from "./lib.ts";

interface AuditEntry {
  id: string;
  numericValue?: number;
  score: null | number;
  scoreDisplayMode: string;
}

interface Lhr {
  audits: Record<string, AuditEntry | undefined>;
  categories: Record<
    string,
    undefined | { auditRefs: Array<{ id: string }>; score?: null | number }
  >;
}

type Preset = "desktop" | "mobile";

const run = (url: string, preset: Preset, file: string): Promise<void> =>
  new Promise((resolve) => {
    const args = [
      "exec",
      "lighthouse",
      url,
      `--chrome-path=${chromePath()}`,
      "--chrome-flags=--headless=new",
      "--only-categories=performance,accessibility,best-practices,seo",
      "--output=json",
      `--output-path=${file}`,
      "--quiet",
    ];
    if (preset === "desktop") args.push("--preset=desktop");
    const child = spawn("pnpm", args, { cwd: root, stdio: "ignore" });
    const timer = setTimeout(() => child.kill("SIGKILL"), 180_000);
    const done = (): void => {
      clearTimeout(timer);
      resolve();
    };
    child.on("close", done);
    child.on("error", done);
  });

const numeric = (lhr: Lhr, id: string): number =>
  lhr.audits[id]?.numericValue ?? NaN;

const failing = (lhr: Lhr, category: string): string[] => {
  const skipped = new Set(["informative", "manual", "notApplicable"]);
  const ids: string[] = [];
  const refs = lhr.categories[category]?.auditRefs ?? [];
  for (const ref of refs) {
    const entry = lhr.audits[ref.id];
    if (
      entry &&
      entry.score !== null &&
      entry.score < 1 &&
      !skipped.has(entry.scoreDisplayMode)
    )
      ids.push(entry.id);
  }
  return ids;
};

const check: Check = async (audit) => {
  const result = newResult("lighthouse");
  const dir = path.join(audit.out, "lighthouse");
  fs.mkdirSync(dir, { recursive: true });
  const home = audit.pages.find((entry) => entry.kind === "home");
  if (!home) return skip("lighthouse", "no home page to audit");
  const plan: Array<[Page, number]> = [[home, audit.fast ? 1 : 3]];
  if (!audit.fast)
    for (const kind of ["blog", "post"]) {
      const entry = audit.pages.find((candidate) => candidate.kind === kind);
      if (entry) plan.push([entry, 1]);
    }
  for (const [entry, runs] of plan) {
    for (const preset of ["mobile", "desktop"] as const) {
      const reports: Lhr[] = [];
      for (let index = 1; index <= runs; index += 1) {
        const file = path.join(
          dir,
          `${pageSlug(entry.url)}-${preset}-${String(index)}.json`
        );
        await run(entry.url, preset, file);
        if (fs.existsSync(file))
          reports.push(JSON.parse(fs.readFileSync(file, "utf8")) as Lhr);
      }
      const where = `${entry.path} ${preset}`;
      const first = reports[0];
      if (!first) {
        note(result, "fail", `${where}: Lighthouse produced no report`);
        continue;
      }
      const score = (category: string): number =>
        median(
          reports.map(
            (report) => (report.categories[category]?.score ?? 0) * 100
          )
        );
      const slug = `${pageSlug(entry.url)}_${preset}`;
      const measured = {
        a11y: score("accessibility"),
        bp: score("best-practices"),
        cls: median(
          reports.map((report) => numeric(report, "cumulative-layout-shift"))
        ),
        fcp: median(
          reports.map((report) => numeric(report, "first-contentful-paint"))
        ),
        kb: median(
          reports.map((report) => numeric(report, "total-byte-weight") / 1024)
        ),
        lcp: median(
          reports.map((report) => numeric(report, "largest-contentful-paint"))
        ),
        perf: score("performance"),
        seo: score("seo"),
        tbt: median(
          reports.map((report) => numeric(report, "total-blocking-time"))
        ),
      };
      for (const [key, value] of Object.entries(measured))
        result.metrics[`${key}_${slug}`] = Number(
          value.toFixed(key === "cls" ? 3 : 0)
        );
      note(
        result,
        "info",
        `${where} (${String(reports.length)} runs, median): perf ${String(measured.perf)}, a11y ${String(measured.a11y)}, best practices ${String(measured.bp)}, SEO ${String(measured.seo)}; FCP ${String(Math.round(measured.fcp))} ms, LCP ${String(Math.round(measured.lcp))} ms, TBT ${String(Math.round(measured.tbt))} ms, CLS ${measured.cls.toFixed(3)}, ${String(Math.round(measured.kb))} KB`
      );
      for (const [category, label] of [
        ["accessibility", "a11y"],
        ["best-practices", "best practices"],
        ["seo", "SEO"],
      ] as const) {
        const value = score(category);
        if (value < 100)
          note(
            result,
            "fail",
            `${where}: ${label} ${String(value)}: ${failing(first, category).join(", ")}`
          );
      }
      const old = audit.baseline?.results.find(
        (entryResult) => entryResult.name === "lighthouse"
      )?.metrics[`perf_${slug}`];
      if (typeof old === "number" && measured.perf < old - 5)
        note(
          result,
          "warn",
          `${where}: performance fell from ${String(old)} to ${String(measured.perf)}`
        );
    }
  }
  const mobile = result.metrics["perf_home_mobile"];
  const desktop = result.metrics["perf_home_desktop"];
  result.summary = `home perf mobile ${String(mobile ?? "?")} / desktop ${String(desktop ?? "?")} (local, noisy; LCP over-reported); a11y, best practices and SEO must be 100`;
  return result;
};

export default check;
