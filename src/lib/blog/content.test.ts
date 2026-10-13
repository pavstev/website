import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { readPostSources } from "./posts.ts";

const sources = readPostSources();

describe("committed posts", () => {
  it("use no em or en dashes", () => {
    for (const source of sources) {
      const text = readFileSync(path.join(source.dir, "index.mdx"), "utf8");
      assert.doesNotMatch(
        text,
        /[\u{2013}\u{2014}]/u,
        `${source.slug}: replace each em or en dash with a comma, a colon or a new sentence`
      );
    }
  });
});
