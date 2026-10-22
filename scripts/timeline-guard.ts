import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const shorthandPattern = /(?<![\w-])animation:([^;}]*)/gu;
const timelinePattern = /\b(?:scroll|view)\(|(?:^|[\s,])--[\w-]/u;

export const timelineShorthands = (css: string): string[] =>
  css
    .matchAll(shorthandPattern)
    .map((match) => match[1] ?? "")
    .filter((value) => timelinePattern.test(value))
    .map((value) => `animation:${value}`)
    .toArray();

const builtFiles = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:css|html)$/u.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));

if (import.meta.main) {
  const files = builtFiles("dist");
  let failed = false;
  for (const file of files) {
    const found = timelineShorthands(readFileSync(file, "utf8"));
    for (const shorthand of found) {
      console.error(`${file}: timeline folded into ${shorthand}`);
      failed = true;
    }
  }
  if (failed) process.exitCode = 1;
  else console.warn(`Timeline guard passed: ${String(files.length)} files.`);
}
