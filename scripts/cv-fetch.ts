import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { cvCachePath, cvSourcePath, loadCv } from "../src/lib/cv.ts";
import { personalData } from "../src/lib/personal.ts";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

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
  const { cv, source } = await loadCv({
    env: process.env,
    liveUrl: values["live-url"] ?? `${personalData.website}/cv.json`,
    timeoutMs,
  });
  await mkdir(path.dirname(cvCachePath), { recursive: true });
  await writeFile(cvCachePath, `${JSON.stringify(cv, null, 2)}\n`);
  await writeFile(cvSourcePath, source);
  console.warn(
    source === "feed"
      ? `CV from the feed, updatedAt ${cv.updatedAt}`
      : `The CV feed did not answer, so the live ${personalData.website}/cv.json was used, updatedAt ${cv.updatedAt}`
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "CV fetch failed");
  process.exitCode = 1;
}
