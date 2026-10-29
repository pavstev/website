import type { Repo, RepoLanguage } from "./github.ts";

import { type BuildEnv, fixturesEnabled } from "./blog/build-env.ts";
import { type Product, products } from "./products.ts";
import { maxProducts, workConfig } from "./work.ts";

const base = products[0];

const fakeProduct = (
  name: string,
  line: string,
  role: string,
  period: string
): Product[] =>
  base
    ? [
        {
          ...base,
          line,
          name,
          period,
          role,
          url: `https://${name.toLowerCase().replaceAll(" ", "-")}.example`,
        },
      ]
    : [];

const fakeProducts: readonly Product[] = [
  ...fakeProduct(
    "Fixture Orbit",
    "A made-up product with a long description, so the text has to wrap around the round logo for several lines and the card grows tall.",
    "Advisor",
    "2019 to 2021"
  ),
  ...fakeProduct(
    "Fixture Lantern With A Much Longer Product Name",
    "Short line.",
    "Founding engineer & tech lead",
    "since 2024"
  ),
];

const langs = (...names: string[]): RepoLanguage[] =>
  names.map((name) => ({ name }));

const fakeRepo = (
  name: string,
  description: string,
  languages: RepoLanguage[],
  topics: string[],
  stars = 0,
  forks = 0
): Repo => ({
  description,
  forks,
  language: languages[0]?.name,
  languages,
  name,
  pushedAt: new Date(Date.UTC(2026, 0, 1 + name.length * 9)).toISOString(),
  stars,
  topics,
  url: `https://github.com/fixture/${name}`,
});

const manyLanguages = langs(
  "TypeScript",
  "JavaScript",
  "CSS",
  "HTML",
  "Astro",
  "MDX",
  "Shell",
  "Python"
);

const manyTopics = [
  "react",
  "tailwindcss",
  "threejs",
  "webgl",
  "pnpm",
  "cloudflare-workers",
];

const longText =
  "A made-up project with a very long description. It goes on and on about nothing in particular, so the card text takes many lines and the cards beside it must keep their tags and action rows lined up with it. It exists only for the dev fixture.";

const fakeRepos: readonly Repo[] = [
  fakeRepo(
    "dotfiles",
    "Fixture copy of a repo that has a story.",
    langs("Shell", "Rust"),
    ["zsh", "mise", "macos"],
    42,
    5
  ),
  fakeRepo(
    "website",
    "Fixture copy of a repo that has a story and many tags.",
    manyLanguages,
    manyTopics,
    12,
    1
  ),
  fakeRepo("fixture-atlas", "Tiny CLI.", [], []),
  fakeRepo("fixture-beacon", longText, langs("Go", "Shell"), ["linux"], 3),
  fakeRepo(
    "fixture-cinder",
    "One language, one line of text.",
    langs("Rust"),
    [],
    128
  ),
  fakeRepo(
    "fixture-delta",
    "A mid-length description that wraps once or twice on a narrow card.",
    langs("Swift", "Shell"),
    ["swiftui", "macos", "whisperkit"],
    0,
    3
  ),
  fakeRepo("fixture-ember", longText, manyLanguages, manyTopics, 1024, 64),
  fakeRepo("fixture-flint", "Short text.", langs("Python"), ["mlx"]),
  fakeRepo(
    "fixture-garnet",
    "Medium text for a card with a handful of tags in a row.",
    langs("TypeScript", "CSS", "HTML"),
    ["react", "nextjs", "pwa", "typescript"],
    7
  ),
  fakeRepo("fixture-harbor", longText, [], ["linux"], 0, 0),
  fakeRepo("fixture-isle", "Two words.", langs("Ruby"), [], 2),
  fakeRepo(
    "fixture-jade",
    "A project with every tag kind at once, language dots and logos.",
    langs("TypeScript", "Rust", "Swift", "Go", "Python"),
    ["claude-code", "cursor", "opencode", "starship", "windows"],
    19,
    2
  ),
  fakeRepo("fixture-kiln", "Mid text, no tags at all.", [], [], 4),
  fakeRepo("fixture-lumen", longText, langs("Astro", "MDX"), ["webgl"], 0, 1),
];

export const withFixtureProducts = (
  real: readonly Product[],
  env: BuildEnv = process.env
): Product[] =>
  fixturesEnabled(env)
    ? [...real, ...fakeProducts].slice(0, maxProducts)
    : [...real];

export const withFixtureRepos = (
  real: readonly Repo[],
  env: BuildEnv = process.env
): Repo[] =>
  fixturesEnabled(env)
    ? [
        ...real,
        ...fakeRepos.filter(({ name }) => real.every((r) => r.name !== name)),
      ].slice(0, workConfig.repos.max)
    : [...real];
