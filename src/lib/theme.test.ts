import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  designTokens,
  ditherTones,
  hexBytes,
  inkPalette,
  profilePalette,
  storyPalette,
} from "./theme.ts";

const srcDir = path.join(import.meta.dirname, "..");
const stylesDir = path.join(srcDir, "styles");
const tokensCss = readFileSync(path.join(stylesDir, "tokens.css"), "utf8");

const baseBlock = tokensCss.slice(0, tokensCss.indexOf("\n:is("));

const declared = new Map(
  baseBlock
    .matchAll(/(--[\w-]+):([^;]*);/g)
    .map((match) => [match[1] ?? "", (match[2] ?? "").trim()] as const)
);

const resolve = (name: string): string => {
  const value = declared.get(name);
  assert.ok(value, `${name} is not in tokens.css`);
  const alias = /^var\((--[\w-]+)\)$/.exec(value);
  return alias?.[1] === undefined ? value.toLowerCase() : resolve(alias[1]);
};

const controlLists = tokensCss
  .matchAll(/:is\(([^)]*)\)/g)
  .map((match) => (match[1] ?? "").replaceAll(/\s+/g, ""))
  .toArray();

const literal =
  /#[0-9a-f]{3}\b|#[0-9a-f]{6}\b|#[0-9a-f]{8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(|(?<![-\w])(?:white|black)(?![-\w])/i;

const sourceHex = /#[0-9a-f]{3,8}(?![\w-])|\b(?:rgba?|hsla?|oklab|oklch)\(/i;

const hexAllowed = new Set([
  "lib/icon-data.ts",
  "lib/sky-palette.ts",
  "lib/theme.ts",
]);

const sourceFiles = (): string[] =>
  readdirSync(srcDir, { recursive: true })
    .map(String)
    .filter(
      (name) => /\.(?:ts|tsx|astro)$/.test(name) && !name.endsWith(".test.ts")
    );

const offendingLines = (text: string, pattern: RegExp): string[] =>
  text
    .split("\n")
    .map((line, index) => ({ index, line }))
    .filter(({ line }) => pattern.test(line))
    .map(({ index, line }) => `${String(index + 1)}: ${line.trim()}`);

describe("hexBytes", () => {
  it("reads a six-digit hex color as three bytes", () => {
    assert.deepEqual(hexBytes("#000000"), [0, 0, 0]);
    assert.deepEqual(hexBytes("#ff8000"), [255, 128, 0]);
    assert.deepEqual(hexBytes("#0a0b0c"), [10, 11, 12]);
  });
});

describe("theme.ts mirrors tokens.css", () => {
  const pairs: Array<[string, string]> = [
    [designTokens.background, "--background"],
    [inkPalette.dark, "--background"],
    [inkPalette.foreground, "--foreground"],
    [inkPalette.soft, "--foreground-soft"],
    [inkPalette.muted, "--muted-foreground"],
    [profilePalette.sky.blue, "--sky-blue"],
    [profilePalette.sky.gold, "--sky-gold"],
    [profilePalette.sky.rose, "--sky-rose"],
    [profilePalette.sky.teal, "--sky-teal"],
    [profilePalette.sky.violet, "--sky-violet"],
    [ditherTones[0], "--background"],
    [ditherTones[2], "--ui-accent"],
    [ditherTones[3], "--ui-stone-200"],
    [storyPalette.ink, "--story-ink"],
    [storyPalette.line, "--story-line"],
    [storyPalette.muted, "--story-muted"],
    [storyPalette.accent, "--story-accent"],
    [storyPalette.mark, "--story-mark"],
    [storyPalette.markAlt, "--story-mark-alt"],
    [storyPalette.denied, "--story-denied"],
    [storyPalette.paper, "--story-paper"],
  ];

  for (const [hex, token] of pairs) {
    it(`${token} equals ${hex}`, () => {
      assert.equal(resolve(token), hex.toLowerCase());
    });
  }

  it("--story-white is the six-digit white", () => {
    assert.equal(resolve("--story-white"), "#fff");
    assert.equal(storyPalette.white.toLowerCase(), "#ffffff");
  });

  const alphas: Array<[number, string]> = [
    [storyPalette.dot, "--story-dot"],
    [storyPalette.hairStrong, "--story-hair-strong"],
  ];

  for (const [alpha, token] of alphas) {
    it(`${token} is white at ${String(alpha)}`, () => {
      assert.equal(resolve(token), `rgb(255 255 255 / ${String(alpha)})`);
    });
  }
});

describe("tokens.css modes", () => {
  it("uses one control list for the night lift and the day remap", () => {
    assert.ok(controlLists.length >= 2);
    assert.equal(new Set(controlLists).size, 1);
  });
});

describe("color literals", () => {
  it("live only in tokens.css among the style sheets", () => {
    const sheets = readdirSync(stylesDir).filter(
      (name) => name.endsWith(".css") && name !== "tokens.css"
    );
    for (const name of sheets) {
      const text = readFileSync(path.join(stylesDir, name), "utf8");
      assert.deepEqual(offendingLines(text, literal), [], name);
    }
  });

  it("live only in theme.ts and sky-palette.ts among the sources", () => {
    const files = sourceFiles();
    assert.ok(files.length > 100);
    for (const name of files) {
      const file = name.split(path.sep).join("/");
      if (hexAllowed.has(file)) continue;
      const text = readFileSync(path.join(srcDir, name), "utf8");
      assert.deepEqual(offendingLines(text, sourceHex), [], file);
    }
  });
});
