import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getContact, getRepos } from "../lib/github.ts";
import { en } from "../lib/i18n.ts";
import { personalData } from "../lib/personal.ts";
import { productMeta, products } from "../lib/products.ts";
import { reachable } from "./reachable.ts";
import { resumeUrl } from "./readme.ts";
import { renderProfile } from "./render.ts";
import { validateProfile } from "./validate.ts";

const root = process.cwd();
const outDir = path.join(root, ".profile-out");
const checkMode = process.argv.includes("--check");

const [repos, contact] = await Promise.all([
  getRepos(personalData.githubHandle),
  getContact(personalData.githubHandle),
]);
const person = { ...personalData, linkedin: contact.linkedin };
const files = renderProfile({
  personal: person,
  products: products.map((product) => ({
    line: product.line,
    meta: productMeta(product),
    name: product.name,
    url: product.url,
  })),
  repos,
  strings: en,
});

const errors = validateProfile(files, { generated: en.profile.generated });
if (checkMode && errors.length === 0) {
  errors.push(
    ...(await reachable(personalData.website)),
    ...(await reachable(resumeUrl(person.website)))
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
