import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import {
  type Cv,
  cvCachePath,
  cvSourcePath,
  loadCv,
  parseCv,
} from "../src/lib/cv.ts";
import { personalData } from "../src/lib/personal.ts";
import snapshot from "./cv-snapshot.json" with { type: "json" };

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const describe = (cv: Cv, source: string): string => {
  if (source === "feed") return `CV from the feed, updatedAt ${cv.updatedAt}`;
  return source === "snapshot"
    ? `CV from scripts/cv-snapshot.json (CV_SNAPSHOT=1), updatedAt ${cv.updatedAt}`
    : `The CV feed did not answer, so the live ${personalData.website}/cv.json was used, updatedAt ${cv.updatedAt}`;
};

try {
  const { values } = parseArgs({
    options: {
      "live-url": { type: "string" },
      "timeout-ms": { type: "string" },
    },
  });
  const timeoutMs =
    values["timeout-ms"] === undefined
      ? undefined
      : Number(values["timeout-ms"]);
  if (
    timeoutMs !== undefined &&
    !(Number.isSafeInteger(timeoutMs) && timeoutMs > 0)
  ) {
    throw new Error("--timeout-ms must be a positive whole number");
  }
  const { cv, source } =
    process.env["CV_SNAPSHOT"] === "1"
      ? {
          cv: parseCv(snapshot, "scripts/cv-snapshot.json"),
          source: "snapshot",
        }
      : await loadCv({
          env: process.env,
          liveUrl: values["live-url"] ?? `${personalData.website}/cv.json`,
          timeoutMs,
        });
  await mkdir(path.dirname(cvCachePath), { recursive: true });
  await writeFile(cvCachePath, `${JSON.stringify(cv, null, 2)}\n`);
  await writeFile(cvSourcePath, source);
  console.warn(describe(cv, source));
} catch (error) {
  console.error(error instanceof Error ? error.message : "CV fetch failed");
  process.exitCode = 1;
}
