import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { getContact, getRepos } from "../lib/github.ts";
import { en } from "../lib/i18n.ts";
import { iconData } from "../lib/icon-data.ts";
import { personalData } from "../lib/personal.ts";
import { resumeUrl } from "./icons.ts";
import { renderProfile } from "./render.ts";
import { compareText } from "./text.ts";
import { validateProfile } from "./validate.ts";

const root = process.cwd();
const outDir = path.join(root, ".profile-out");
const fontDir = path.join(root, "public", "fonts");
const checkMode = process.argv.includes("--check");

const readFont = (prefix: string): Uint8Array => {
  const name = readdirSync(fontDir)
    .filter((file) => file.startsWith(prefix) && file.endsWith(".woff2"))
    .toSorted(compareText)
    .at(-1);
  if (!name) throw new Error(`No font file starting with "${prefix}"`);
  return readFileSync(path.join(fontDir, name));
};

const reachable = async (url: string): Promise<string[]> => {
  const response = await fetch(url, {
    method: "HEAD",
    signal: AbortSignal.timeout(15_000),
  });
  return response.ok ? [] : [`${url} answered ${String(response.status)}`];
};

const [repos, contact] = await Promise.all([
  getRepos(personalData.githubHandle),
  getContact(personalData.githubHandle),
]);
const person = { ...personalData, linkedin: contact.linkedin };
const files = renderProfile({
  fonts: {
    extra: readFont("inter-extra-wght-"),
    latin: readFont("inter-latin-wght-"),
    nameExtra: readFont("parkinsans-extra-wght-"),
    nameLatin: readFont("parkinsans-latin-wght-"),
  },
  icons: iconData,
  personal: person,
  repos,
  strings: en,
});

const errors = validateProfile(files, { generated: en.profile.generated });
if (checkMode && errors.length === 0) {
  errors.push(
    ...(await reachable(personalData.website)),
    ...(await reachable(resumeUrl(person)))
  );
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
} else {
  rmSync(outDir, { force: true, recursive: true });
  for (const file of files) {
    const target = path.join(outDir, file.path);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, file.contents);
  }
  console.warn(`Wrote ${String(files.length)} files to .profile-out/`);
}
