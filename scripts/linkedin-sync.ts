import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { getCv } from "../src/lib/cv.ts";
import {
  buildSnapshot,
  changeTitle,
  diffSnapshots,
  type Notes,
  parseStateBody,
  renderChanges,
  renderChecklist,
  type Snapshot,
  stateBody,
} from "../src/lib/linkedin-fields.ts";
import { personalData } from "../src/lib/personal.ts";
import { products } from "../src/lib/products.ts";

const { values } = parseArgs({
  options: {
    "dry-run": { type: "boolean" },
    out: { type: "string" },
    previous: { type: "string" },
    ref: { type: "string" },
  },
});

const dryRun = values["dry-run"] === true;
const outDir = values.out;

if (!dryRun && outDir === undefined) {
  throw new Error("Pass --out <dir>, or --dry-run to write nothing");
}

const previousFile = values.previous;
const ref = values.ref ?? "main";

type Status = "changed" | "first" | "same";

const repository = process.env["GITHUB_REPOSITORY"] ?? "pavstev/website";
const coverFile = "public/linkedin-cover.png";
const portraitFile = path.join("public", personalData.portrait.url);
const portraitJpegFile = "public/stevan-pavlovic.jpeg";
const issueBodyLimit = 60_000;
const firstTitle = "Align LinkedIn with stevanpavlovic.com once";

const sha256 = async (file: string): Promise<string> =>
  createHash("sha256")
    .update(await readFile(file))
    .digest("hex");

const loadPrevious = async (): Promise<Snapshot | undefined> => {
  if (previousFile === undefined) return undefined;
  const body = await readFile(previousFile, "utf8");
  return body.trim() === "" ? undefined : parseStateBody(body);
};

const rawLink = (file: string): string =>
  `https://raw.githubusercontent.com/${repository}/${ref}/${file}`;

const notes: Notes = new Map([
  [
    "cover",
    [
      `**Image:** ${rawLink(coverFile)} (this link works at once)`,
      `**Site copy:** ${personalData.website}/linkedin-cover.png (updates after the next deploy)`,
    ].join("\n\n"),
  ],
  [
    "photo",
    [
      `**Upload this file:** ${rawLink(portraitJpegFile)}`,
      `**Card portrait:** ${rawLink(portraitFile)}`,
    ].join("\n\n"),
  ],
]);

const hashes = {
  cover: await sha256(coverFile),
  portrait: await sha256(portraitFile),
  portraitJpeg: await sha256(portraitJpegFile),
};

const after = buildSnapshot({
  cv: await getCv(),
  hashes,
  person: personalData,
  products,
});

const before = await loadPrevious();
const changes = before === undefined ? [] : diffSnapshots(before, after);

const status: Status =
  before === undefined ? "first" : changes.length === 0 ? "same" : "changed";

const title = status === "first" ? firstTitle : changeTitle(changes);
const body =
  status === "first"
    ? renderChecklist(after, notes, personalData.githubHandle)
    : renderChanges(changes, notes, personalData.githubHandle);
const state = stateBody(after);

if (status !== "same" && Math.max(body.length, state.length) > issueBodyLimit) {
  throw new Error(
    `An issue body is longer than ${String(issueBodyLimit)} characters`
  );
}

if (dryRun) {
  const lines = [
    `Status: ${status}`,
    `Fields: ${String(Object.keys(after.fields).length)}`,
    `State issue body: ${String(state.length)} characters`,
  ];
  if (status !== "same") {
    lines.push(
      `Title: ${title}`,
      `Issue body (${String(body.length)} characters):`,
      "",
      body
    );
  }
  process.stdout.write(`${lines.join("\n")}\n`);
} else if (outDir !== undefined) {
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "status"), status);
  if (status !== "same") {
    await Promise.all([
      writeFile(path.join(outDir, "title.txt"), title),
      writeFile(path.join(outDir, "body.md"), body),
      writeFile(path.join(outDir, "state.md"), state),
    ]);
  }
  console.warn(
    `LinkedIn sync: ${status}${status === "changed" ? ` (${String(changes.length)} changes)` : ""}`
  );
}
