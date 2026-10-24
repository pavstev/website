import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";

interface Outcome {
  name: string;
  ok: boolean;
  text: string;
}

interface Step {
  args: string[];
  name: string;
}

const lintable = /\.(?:astro|cjs|js|md|mdx|mjs|mts|ts|tsx)$/u;
const testable = /\.(?:ts|tsx)$/u;

const paths = (...git: string[]): string[] =>
  execFileSync("git", [...git, "-z"], { encoding: "utf8" })
    .split("\0")
    .filter((file) => file.length > 0);

const changedFiles = (staged: boolean): string[] => {
  const found = staged
    ? paths("diff", "--cached", "--name-only", "--diff-filter=ACMR")
    : [
        ...paths("diff", "HEAD", "--name-only", "--diff-filter=ACMR"),
        ...paths("ls-files", "--others", "--exclude-standard"),
      ];
  return [...new Set(found)].filter((file) => existsSync(file));
};

const relatedTests = (files: string[]): string[] => {
  const tests = files
    .filter((file) => testable.test(file))
    .map((file) =>
      file.endsWith(".test.ts") ? file : file.replace(testable, ".test.ts")
    );
  return [...new Set(tests)].filter((file) => existsSync(file));
};

const run = ({ args, name }: Step): Promise<Outcome> =>
  new Promise((resolve) => {
    const child = spawn("pnpm", ["exec", ...args], { stdio: "pipe" });
    const chunks: Buffer[] = [];
    const collect = (chunk: Buffer): void => {
      chunks.push(chunk);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("close", (code) => {
      resolve({
        name,
        ok: code === 0,
        text: Buffer.concat(chunks).toString("utf8"),
      });
    });
  });

const { values } = parseArgs({ options: { staged: { type: "boolean" } } });
const files = changedFiles(values.staged ?? false);
const linted = files.filter((file) => lintable.test(file));
const tests = relatedTests(files);
const steps: Step[] = [
  ...(files.length > 0
    ? [
        {
          args: [
            "prettier",
            "--check",
            "--ignore-unknown",
            "--log-level=warn",
            ...files,
          ],
          name: "prettier",
        },
      ]
    : []),
  ...(linted.length > 0
    ? [
        {
          args: ["eslint", "--max-warnings=0", "--no-warn-ignored", ...linted],
          name: "eslint",
        },
      ]
    : []),
  ...(tests.length > 0
    ? [
        {
          args: ["node", "--test", "--test-reporter=dot", ...tests],
          name: "tests",
        },
      ]
    : []),
];
const results = await Promise.all(steps.map((step) => run(step)));
const failed = results.filter((outcome) => !outcome.ok);
for (const outcome of failed)
  console.error(`check:fast ${outcome.name} failed\n${outcome.text}`);
process.exitCode = failed.length > 0 ? 1 : 0;
