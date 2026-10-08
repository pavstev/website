import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import {
  type Cv,
  CvFeedError,
  cvSourcePath,
  fetchFeed,
  getCv,
  isNewer,
} from "../src/lib/cv.ts";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const outdated =
  "The résumé changed during this build. A newer build is on its way.";

const readSource = async (): Promise<string> => {
  try {
    const source = await readFile(cvSourcePath, "utf8");
    return source.trim();
  } catch {
    throw new Error(
      `${cvSourcePath} is missing: the build did not run scripts/cv-fetch.ts`
    );
  }
};

const readTimeout = (): number | undefined => {
  const { values } = parseArgs({
    options: { "timeout-ms": { type: "string" } },
  });
  if (values["timeout-ms"] === undefined) return undefined;
  const timeoutMs = Number(values["timeout-ms"]);
  if (!(Number.isSafeInteger(timeoutMs) && timeoutMs > 0)) {
    throw new Error("--timeout-ms must be a positive whole number");
  }
  return timeoutMs;
};

const currentFeed = async (): Promise<Cv | undefined> => {
  try {
    return await fetchFeed(process.env, fetch, readTimeout());
  } catch (error) {
    if (error instanceof CvFeedError && error.kind === "unavailable") {
      return undefined;
    }
    throw error;
  }
};

try {
  const source = await readSource();
  if (source === "live") {
    console.warn("CV guard skipped: this build used the live CV.");
  } else {
    const built = await getCv();
    const current = await currentFeed();
    if (current === undefined) {
      console.warn("CV guard skipped: the CV feed did not answer.");
    } else if (isNewer(current, built)) {
      console.error(outdated);
      process.exitCode = 1;
    } else {
      console.warn(`CV guard passed: the build holds ${built.updatedAt}`);
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "CV guard failed");
  process.exitCode = 1;
}
