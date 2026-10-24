import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.join(import.meta.dirname, "../../../content");

const posts = existsSync(root)
  ? readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
      .map((entry) => path.join(entry.parentPath, entry.name))
  : [];

describe("committed posts", () => {
  it("use no em or en dashes", () => {
    for (const file of posts) {
      assert.doesNotMatch(
        readFileSync(file, "utf8"),
        /[\u{2013}\u{2014}]/u,
        `${path.relative(root, file)}: replace each em or en dash with a comma, a colon or a new sentence`
      );
    }
  });
});
