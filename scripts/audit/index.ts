import { execFileSync, spawn } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import type { Baseline, Check, Context, Page, Result } from "./types.ts";

import a11y from "./check-a11y.ts";
import contrast from "./check-contrast.ts";
import html from "./check-html.ts";
import layout from "./check-layout.ts";
import lighthouse from "./check-lighthouse.ts";
import links from "./check-links.ts";
import runtime from "./check-runtime.ts";
import seo from "./check-seo.ts";
import shots from "./check-shots.ts";
import sizes from "./check-sizes.ts";
import worker from "./check-worker.ts";
import { closeBrowser, root, setWorkers, sleep } from "./lib.ts";
import { classify, notFoundPath } from "./pages.ts";

const checks: Record<string, Check> = {
  a11y,
  contrast,
  html,
  layout,
  lighthouse,
  links,
  runtime,
  seo,
  shots,
  sizes,
  worker,
};
const checkNames = Object.keys(checks);

const usage = `Audit of the built site. Reports go to .audit/ (not in git).

pnpm audit:site [options]

Default: pnpm build, serve dist with wrangler dev (the Worker routes too), run every check.

  --fast          smaller matrices (about a third of the time)
  --only a,b      run only these checks
  --skip a,b      skip these checks
  --baseline      save this run as the baseline later runs compare to
  --label name    report folder name (default: date and time)
  --no-build      reuse the last dist
  --url https://  audit a running site instead (no build, no sizes check)
  --port n        port for wrangler dev (default 8790)
  --workers n     browser pages at the same time (default 4); lighthouse runs alone at the end

Checks: ${checkNames.join(", ")}
Report: .audit/audit-<label>/report.md (also .audit/audit-latest)`;

const { values: options } = parseArgs({
  options: {
    baseline: { default: false, type: "boolean" },
    fast: { default: false, type: "boolean" },
    help: { default: false, type: "boolean" },
    label: { type: "string" },
    "no-build": { default: false, type: "boolean" },
    only: { type: "string" },
    port: { default: "8790", type: "string" },
    skip: { type: "string" },
    url: { type: "string" },
    workers: { default: "4", type: "string" },
  },
});

const list = (value = ""): string[] =>
  value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

const only = list(options.only);
const skipped = new Set(list(options.skip));
const unknown = [...only, ...skipped].filter(
  (name) => !checkNames.includes(name)
);
const started = Date.now();
const reports = path.join(root, ".audit");
const stamp = new Date()
  .toISOString()
  .slice(0, 16)
  .replaceAll(/[-:]/gu, "")
  .replace("T", "-");
const label = options.label ?? stamp;
const out = path.join(reports, `audit-${label}`);

const say = (text: string): void => {
  const seconds = String(Math.round((Date.now() - started) / 1000));
  process.stdout.write(`[${seconds.padStart(4)}s] ${text}\n`);
};

const git = (...args: string[]): string => {
  try {
    return execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
};

const logTo = (name: string): number => openSync(path.join(out, name), "a");

const exec = (command: string, args: string[], log: string): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const descriptor = logTo(log);
    const child = spawn(command, args, {
      cwd: root,
      env: {
        ...process.env,
        WORKERS_CI_COMMIT_SHA: git("rev-parse", "HEAD"),
      },
      stdio: ["ignore", descriptor, descriptor],
    });
    child.on("close", (code) => {
      closeSync(descriptor);
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `${command} ${args.join(" ")} failed with ${String(code)}, log: ${log}`
          )
        );
    });
  });

const answers = async (base: string): Promise<boolean> => {
  try {
    const response = await fetch(`${base}/`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.status < 500;
  } catch {
    return false;
  }
};

interface Server {
  base: string;
  stop: () => void;
}

const serve = async (): Promise<Server> => {
  const { port } = options;
  const base = `http://localhost:${port}`;
  if (await answers(base)) throw new Error(`port ${port} is busy; pass --port`);
  const descriptor = logTo("wrangler.log");
  const child = spawn(
    "pnpm",
    [
      "exec",
      "wrangler",
      "dev",
      "--port",
      port,
      "--ip",
      "localhost",
      "--show-interactive-dev-session=false",
    ],
    {
      cwd: root,
      detached: true,
      env: { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" },
      stdio: ["ignore", descriptor, descriptor],
    }
  );
  const stop = (): void => {
    if (child.pid === undefined) return;
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch (error) {
      process.stderr.write(`wrangler did not stop: ${String(error)}\n`);
    }
  };
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await answers(base)) return { base, stop };
    await sleep(500);
  }
  stop();
  throw new Error(`wrangler dev did not answer, see ${out}/wrangler.log`);
};

const discover = async (
  base: string
): Promise<{ pages: Page[]; sitemap: string }> => {
  const response = await fetch(`${base}/sitemap.xml`);
  const sitemap = await response.text();
  const pages: Page[] = sitemap
    .matchAll(/<loc>([^<]+)<\/loc>/gu)
    .map((match) => {
      const url = (match[1] ?? "").trim();
      const { pathname } = new URL(url);
      return {
        kind: classify(pathname),
        live: url,
        path: pathname,
        url: new URL(pathname, base).href,
      };
    })
    .toArray();
  pages.push({
    kind: "404",
    live: undefined,
    path: notFoundPath,
    url: new URL(notFoundPath, base).href,
  });
  return { pages, sitemap };
};

const format = (value: number): string => {
  if (Math.abs(value) >= 100) return value.toFixed(0);
  return Math.abs(value) >= 1 ? value.toFixed(2) : value.toFixed(3);
};

const changes = (results: Result[], baseline: Baseline): string[] => {
  const rows: string[] = [];
  for (const result of results) {
    const old = baseline.results.find((item) => item.name === result.name);
    for (const [key, value] of Object.entries(result.metrics)) {
      const was = old?.metrics[key];
      if (was === undefined || value === was) continue;
      const percent =
        was === 0
          ? ""
          : ` (${value > was ? "+" : ""}${(((value - was) / Math.abs(was)) * 100).toFixed(1)}%)`;
      rows.push(
        `| ${result.name}.${key} | ${format(was)} | ${format(value)} | ${value > was ? "+" : ""}${format(value - was)}${percent} |`
      );
    }
  }
  return rows;
};

const icons = { fail: "FAIL", pass: "PASS", skip: "skip", warn: "WARN" };

const writeReport = (
  results: Result[],
  meta: Record<string, string>,
  baseline: Baseline | undefined
): void => {
  const markdown = [
    `# Website audit ${label}`,
    "",
    `- Source: ${meta["source"] ?? ""}`,
    `- Served: ${meta["served"] ?? ""}`,
    `- Mode: ${options.fast ? "fast" : "full"}, took ${meta["took"] ?? ""}`,
    `- Baseline: ${baseline ? baseline.label : "none (run with --baseline to save one)"}`,
    "",
    "| Check | Result | Time | Summary |",
    "|---|---|---|---|",
    ...results.map(
      (result) =>
        `| ${result.name} | ${icons[result.status]} | ${String(result.seconds ?? 0)}s | ${result.summary.replaceAll("|", "/")} |`
    ),
    "",
  ];
  if (baseline) {
    const rows = changes(results, baseline);
    markdown.push(
      "## Changes vs baseline",
      "",
      rows.length > 0
        ? `| Metric | Baseline | Now | Change |\n|---|---|---|---|\n${rows.join("\n")}`
        : "No metric changed.",
      ""
    );
  }
  for (const result of results) {
    markdown.push(
      `## ${result.name}: ${icons[result.status]}`,
      "",
      result.summary,
      ""
    );
    if (result.lines.length > 0)
      markdown.push("```text", ...result.lines, "```", "");
  }
  writeFileSync(path.join(out, "report.md"), markdown.join("\n"));
  writeFileSync(
    path.join(out, "report.json"),
    JSON.stringify({ label, results }, null, 1)
  );
};

const relink = (name: string): void => {
  const link = path.join(reports, name);
  rmSync(link, { force: true });
  symlinkSync(`audit-${label}`, link);
};

const loadBaseline = (): Baseline | undefined => {
  const directory = path.join(reports, "audit-baseline");
  const file = path.join(directory, "report.json");
  return !existsSync(file) || realpathSync(directory) === realpathSync(out)
    ? undefined
    : (JSON.parse(readFileSync(file, "utf8")) as Baseline);
};

const runCheck = async (name: string, context: Context): Promise<Result> => {
  say(`check ${name}`);
  const begun = Date.now();
  let result: Result;
  try {
    const check = checks[name];
    if (!check) throw new Error(`no check named ${name}`);
    result = await check(context);
  } catch (error) {
    result = {
      lines: [
        `FAIL check crashed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
      ],
      metrics: {},
      name,
      status: "fail",
      summary: "the check crashed",
    };
  }
  result.seconds = Math.round((Date.now() - begun) / 1000);
  say(`${name}: ${result.status.toUpperCase()} ${result.summary}`);
  return result;
};

const run = async (): Promise<number> => {
  const remote = options.url?.replace(/\/$/u, "");
  let server: Server | undefined;
  try {
    if (!remote && !options["no-build"]) {
      say("build the site");
      await exec("pnpm", ["build"], "build.log");
    }
    if (!remote) {
      say("start wrangler dev");
      server = await serve();
    }
    const base = remote ?? server?.base ?? "";
    const { pages, sitemap } = await discover(base);
    say(`pages: ${pages.map((page) => page.path).join(" ")}`);
    const baseline = loadBaseline();
    const context: Context = {
      base,
      baseline,
      baselineDir: baseline ? path.join(reports, "audit-baseline") : undefined,
      fast: options.fast,
      local: !remote,
      out,
      pages,
      sitemap,
    };
    const selected = (only.length > 0 ? only : checkNames).filter(
      (name) => !skipped.has(name)
    );
    const results = await Promise.all(
      selected
        .filter((name) => name !== "lighthouse")
        .map((name) => runCheck(name, context))
    );
    if (selected.includes("lighthouse"))
      results.push(await runCheck("lighthouse", context));
    const seconds = Math.round((Date.now() - started) / 1000);
    const dirty = git("status", "--porcelain")
      .split("\n")
      .filter(Boolean).length;
    writeReport(
      results,
      {
        served: remote ?? `${base} (wrangler dev)`,
        source: remote
          ? "none (remote site)"
          : `${root} at ${git("rev-parse", "--short", "HEAD")}${dirty > 0 ? ` plus ${String(dirty)} uncommitted files` : ""}`,
        took: `${String(Math.floor(seconds / 60))}m ${String(seconds % 60)}s`,
      },
      baseline
    );
    relink("audit-latest");
    if (options.baseline) relink("audit-baseline");
    const failed = results.filter((result) => result.status === "fail");
    const warned = results.filter((result) => result.status === "warn");
    process.stdout.write(
      `\n${results.map((result) => `${result.status.toUpperCase().padEnd(4)} ${result.name.padEnd(10)} ${result.summary}`).join("\n")}\n\n${String(failed.length)} failed, ${String(warned.length)} with warnings. Report: ${path.join(out, "report.md")}\n`
    );
    return failed.length > 0 ? 1 : 0;
  } catch (error) {
    process.stderr.write(
      `audit stopped: ${error instanceof Error ? error.message : String(error)}\n`
    );
    return 2;
  } finally {
    await closeBrowser();
    server?.stop();
  }
};

if (options.help) process.stdout.write(`${usage}\n`);
else if (unknown.length > 0) {
  process.stderr.write(`unknown checks: ${unknown.join(", ")}\n\n${usage}\n`);
  process.exitCode = 2;
} else {
  setWorkers(Number(options.workers) || 4);
  rmSync(out, { force: true, recursive: true });
  mkdirSync(out, { recursive: true });
  process.exitCode = await run();
}
