import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

import type { Check } from "./types.ts";

import { newResult, note, skip } from "./lib.ts";
import { live } from "./pages.ts";

interface LycheeData {
  error_map?: Record<string, LycheeItem[]>;
  fail_map?: Record<string, LycheeItem[]>;
  total?: number;
}

interface LycheeItem {
  status?: { code?: number; text?: string };
  uri?: string;
  url?: string;
}

interface LycheeRun {
  code: null | number;
  err: string;
  missing: boolean;
  out: string;
}

const run = (args: string[]): Promise<LycheeRun> =>
  new Promise((resolve) => {
    const child = spawn("lychee", args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk: Buffer) => {
      out += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      err += chunk.toString();
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      resolve({
        code: -1,
        err: String(error),
        missing: error.code === "ENOENT",
        out,
      });
    });
    child.on("close", (code) => {
      resolve({ code, err, missing: false, out });
    });
  });

const parse = (text: string): LycheeData | undefined => {
  try {
    return JSON.parse(text) as LycheeData;
  } catch {
    return undefined;
  }
};

const check: Check = async (context) => {
  const result = newResult("links");
  const { origin } = new URL(context.base);
  const urls = context.pages
    .filter((page) => page.kind !== "404")
    .map((page) => page.url);
  const { code, err, missing, out } = await run([
    "--no-progress",
    "--remap",
    `${live} ${origin}`,
    "--format",
    "json",
    "--accept",
    "200..=299,403,429,999",
    "--timeout",
    "20",
    "--max-retries",
    "2",
    "--max-concurrency",
    "8",
    ...urls,
  ]);
  if (missing) return skip("links", "lychee is not installed");
  writeFileSync(path.join(context.out, "lychee.json"), out || err);
  const data = parse(out);
  if (!data) {
    note(
      result,
      "fail",
      `lychee gave no JSON (exit ${String(code)}): ${err.slice(0, 300)}`
    );
    result.summary = "lychee did not run";
    return result;
  }
  const own = [origin, live];
  let broken = 0;
  const failures = Object.entries(data.error_map ?? data.fail_map ?? {});
  for (const [page, list] of failures) {
    for (const item of list) {
      const url = item.url ?? item.uri ?? JSON.stringify(item);
      const status =
        item.status?.text ??
        item.status?.code ??
        JSON.stringify(item.status ?? "");
      const ours = own.some((prefix) => url.startsWith(prefix));
      broken += 1;
      note(
        result,
        ours ? "fail" : "warn",
        `${ours ? "own" : "external"} link ${url} on ${new URL(page).pathname}: ${String(status)}`
      );
    }
  }
  result.metrics["total"] = data.total ?? 0;
  result.metrics["broken"] = broken;
  result.summary = `${String(data.total ?? "?")} links checked on ${String(urls.length)} pages, ${String(broken)} broken (LinkedIn 999 and 403/429 count as fine)`;
  return result;
};

export default check;
