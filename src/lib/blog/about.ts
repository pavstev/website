import { readFileSync } from "node:fs";
import path from "node:path";
import { VFile } from "vfile";
import { matter } from "vfile-matter";
import * as z from "zod";

import { type PostSource } from "./posts.ts";

export const aboutSlug = "about";

const aboutDir = "content/about";

const nonEmpty = z.string().trim().min(1);

const aboutSchema = z.strictObject({
  description: nonEmpty.max(160),
  title: nonEmpty,
});

export interface AboutSource extends Pick<PostSource, "body" | "dir"> {
  description: string;
  slug: typeof aboutSlug;
  title: string;
}

const fail = (field: string, message: string): Error =>
  new Error(`${aboutDir}/index.mdx: ${field}: ${message}`);

export const readAbout = (root: string = process.cwd()): AboutSource => {
  const dir = path.join(root, aboutDir);
  const file = new VFile({
    path: `${aboutDir}/index.mdx`,
    value: readFileSync(path.join(dir, "index.mdx"), "utf8"),
  });
  try {
    matter(file, { strip: true });
  } catch (error) {
    throw fail(
      "frontmatter",
      error instanceof Error ? error.message : String(error)
    );
  }
  const parsed = aboutSchema.safeParse(file.data["matter"]);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    const field = issue?.path.join(".") ?? "";
    throw fail(
      field === "" ? "frontmatter" : field,
      issue?.message ?? "invalid"
    );
  }
  return { ...parsed.data, body: String(file.value), dir, slug: aboutSlug };
};
