import type { ProductKey } from "./products.ts";

export interface RepoPicks {
  hidden: readonly string[];
  max: number;
  pinned: readonly string[];
  stories?: Readonly<Record<string, string>>;
}

export interface WorkConfig {
  productKeys: readonly ProductKey[];
  repos: RepoPicks;
}

export const maxProducts = 3;

export const dotfilesStory = "/work/dotfiles";

export const websiteStory = "/work/website";

export interface StoryEntry {
  key: StoryKey;
  path: string;
}

export type StoryKey = "dotfiles" | "website";

const storyEntries: readonly StoryEntry[] = [
  { key: "website", path: websiteStory },
  { key: "dotfiles", path: dotfilesStory },
];

export const workConfig: WorkConfig = {
  productKeys: ["safety-real-time"],
  repos: {
    hidden: [],
    max: 12,
    pinned: ["website"],
    stories: Object.fromEntries(
      storyEntries.map(({ key, path }) => [key, path])
    ),
  },
};

export const storyEntry = (
  name: string,
  picks: RepoPicks = workConfig.repos
): StoryEntry | undefined => {
  const key = storyEntries.find((entry) => entry.key === name)?.key;
  const path = Object.hasOwn(picks.stories ?? {}, name)
    ? picks.stories?.[name]
    : undefined;
  return key && path ? { key, path } : undefined;
};

export const pickRepos = <T extends { name: string }>(
  repos: readonly T[],
  picks: RepoPicks = workConfig.repos
): T[] => {
  const shown = repos.filter(({ name }) => !picks.hidden.includes(name));
  const pinned = [...new Set(picks.pinned)].flatMap((name) =>
    shown.filter((repo) => repo.name === name).slice(0, 1)
  );
  const rest = shown.filter((repo) => !pinned.includes(repo));
  return [...pinned, ...rest].slice(0, Math.max(0, picks.max));
};

export const pickProducts = <T extends { key: string }>(
  products: readonly T[],
  keys: readonly string[] = workConfig.productKeys
): T[] =>
  [...new Set(keys)]
    .flatMap((key) => products.filter((product) => product.key === key))
    .slice(0, maxProducts);
