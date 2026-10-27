import assert from "node:assert/strict";
import { globSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const sheetImport = /^import "@\/styles\/[\w-]+\.css";$/mu;
const layoutImport = /^import \w+ from "@\/layouts\/\w+\.astro";$/mu;
const pageSheets = /@\/styles\/(?:post|prose|work|about|sky-panel)\.css/u;

describe("page sheets", () => {
  it("imports every page sheet under the layout import", () => {
    const files = globSync("src/pages/**/*.astro");
    assert.ok(files.length > 0, "no pages found");
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const sheet = text.search(sheetImport);
      if (sheet === -1) continue;
      const layout = text.search(layoutImport);
      assert.ok(
        layout !== -1 && layout < sheet,
        `${file}: the sheet import sits under the layout import`
      );
    }
  });

  it("keeps page sheets out of components and layouts", () => {
    const files = globSync("src/{components,layouts}/**/*.astro");
    assert.ok(files.length > 0, "no components found");
    for (const file of files) {
      assert.doesNotMatch(readFileSync(file, "utf8"), pageSheets, file);
    }
  });
});
