import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

const data = "src/data/skill-usage.json";
const subject = "chore(story): refresh the skill usage";
const logFile = "~/Library/Logs/website/skills-weekly.log";

const run = (cwd: string, command: string, args: string[]): void => {
  execFileSync(command, args, { cwd, stdio: "inherit" });
};

const readGit = (cwd: string, args: string[]): string =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

const notify = (text: string): void => {
  execFileSync("osascript", [
    "-e",
    `display notification ${JSON.stringify(text)} with title "Website"`,
  ]);
};

const refresh = (dir: string, dryRun: boolean): string => {
  run(dir, "pnpm", ["install", "--frozen-lockfile", "--prefer-offline"]);
  run(dir, "pnpm", ["skills:usage"]);
  if (readGit(dir, ["status", "--porcelain", "--", data]) === "") {
    return "unchanged";
  }
  run(dir, "pnpm", ["check:fast"]);
  if (dryRun) {
    run(dir, "git", ["--no-pager", "diff", "--stat", "--", data]);
    return "changed, dry run, nothing committed";
  }
  run(dir, "git", ["commit", "--quiet", "--message", subject, "--", data]);
  run(dir, "git", ["pull", "--rebase", "--quiet", "origin", "main"]);
  run(dir, "git", ["push", "--quiet", "origin", "HEAD:main"]);
  return "pushed";
};

const runWeekly = (): void => {
  const { values } = parseArgs({
    options: { "dry-run": { default: false, type: "boolean" } },
  });
  const repo = readGit(process.cwd(), ["rev-parse", "--show-toplevel"]);
  run(repo, "git", ["fetch", "--quiet", "origin", "main"]);
  const dir = mkdtempSync(path.join(tmpdir(), "skills-weekly-"));
  run(repo, "git", [
    "worktree",
    "add",
    "--quiet",
    "--detach",
    dir,
    "origin/main",
  ]);
  try {
    console.warn(`skills weekly: ${refresh(dir, values["dry-run"])}`);
  } finally {
    run(repo, "git", ["worktree", "remove", "--force", dir]);
  }
};

if (import.meta.main) {
  console.warn(`skills weekly: start ${new Date().toISOString()}`);
  try {
    runWeekly();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    notify(`The weekly skill usage refresh failed. Log: ${logFile}`);
    process.exitCode = 1;
  }
}
