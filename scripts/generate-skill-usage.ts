import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { format } from "prettier";

import { parseSession, type SessionRecord, summarize } from "./skill-usage.ts";

const projects = path.join(homedir(), ".claude", "projects");
const workPrefix = `${path.join(homedir(), "work").replaceAll(path.sep, "-")}-`;
const output = "src/data/skill-usage.json";

const pad = (value: number): string => String(value).padStart(2, "0");

const localStamp = (now: Date): string => {
  const offset = -now.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const hours = pad(Math.floor(Math.abs(offset) / 60));
  const minutes = pad(Math.abs(offset) % 60);
  const local = new Date(now.getTime() + offset * 60_000)
    .toISOString()
    .slice(0, 19);
  return `${local}${sign}${hours}:${minutes}`;
};

const logFiles = (): string[] =>
  readdirSync(projects, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(workPrefix))
    .flatMap((entry) => {
      const folder = path.join(projects, entry.name);
      return readdirSync(folder)
        .filter((name) => name.endsWith(".jsonl"))
        .map((name) => path.join(folder, name));
    });

const firstStamp = /"timestamp":"([^"]+)"/u;

const byStart = logFiles()
  .map((file) => ({
    file,
    start: firstStamp.exec(readFileSync(file, "utf8"))?.[1] ?? "",
  }))
  .toSorted((a, b) => a.start.localeCompare(b.start));

const seen = new Set<string>();
const sessions: SessionRecord[] = byStart.flatMap(({ file }) => {
  const record = parseSession(readFileSync(file, "utf8").split("\n"), seen);
  return record ? [record] : [];
});
const usage = summarize(sessions, localStamp(new Date()));
writeFileSync(
  output,
  await format(JSON.stringify(usage), { filepath: output })
);
console.warn(
  `${output}: ${String(usage.sample.sessions)} sessions, ${String(usage.sample.runs)} skill runs, ${usage.period.from} to ${usage.period.to}`
);
