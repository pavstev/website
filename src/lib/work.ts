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

export const workGroups = ["products", "open-source"] as const;

export type WorkFilter = "all" | WorkGroup;

export type WorkGroup = (typeof workGroups)[number];

export const workSorts = ["featured", "stars", "updated", "name"] as const;

export type WorkSort = (typeof workSorts)[number];

export interface WorkView {
  filter: WorkFilter;
  sort: WorkSort;
}

export const defaultWorkView: WorkView = { filter: "all", sort: "featured" };

const oneOf = <T extends string>(
  list: readonly T[],
  value: null | string,
  fallback: T
): T => list.find((item) => item === value) ?? fallback;

export const toWorkView = (
  filter: null | string,
  sort: null | string,
  groups: readonly WorkGroup[] = workGroups
): WorkView => ({
  filter: oneOf<WorkFilter>(
    groups.length > 1 ? ["all", ...groups] : ["all"],
    filter,
    defaultWorkView.filter
  ),
  sort: oneOf(workSorts, sort, defaultWorkView.sort),
});

export const parseWorkView = (
  search: string,
  groups: readonly WorkGroup[] = workGroups
): WorkView => {
  const params = new URLSearchParams(search);
  return toWorkView(params.get("show"), params.get("sort"), groups);
};

export const workViewSearch = (view: WorkView, search: string): string => {
  const params = new URLSearchParams(search);
  const pairs = [
    ["show", view.filter, defaultWorkView.filter],
    ["sort", view.sort, defaultWorkView.sort],
  ] as const;
  for (const [key, value, fallback] of pairs) {
    if (value === fallback) params.delete(key);
    else params.set(key, value);
  }
  const text = params.toString();
  return text ? `?${text}` : "";
};

export interface WorkSortKeys {
  featured: number;
  group: WorkGroup;
  name: string;
  stars: number;
  updated: number;
}

const groupRank: Record<WorkGroup, number> = {
  "open-source": 1,
  products: 0,
};

const byFeatured = (a: WorkSortKeys, b: WorkSortKeys): number =>
  a.featured - b.featured;

const compare: Record<WorkSort, (a: WorkSortKeys, b: WorkSortKeys) => number> =
  {
    featured: byFeatured,
    name: (a, b) =>
      a.name.localeCompare(b.name, "en", { sensitivity: "base" }) ||
      byFeatured(a, b),
    stars: (a, b) => b.stars - a.stars || byFeatured(a, b),
    updated: (a, b) => b.updated - a.updated || byFeatured(a, b),
  };

export const sortWork = <T extends WorkSortKeys>(
  items: readonly T[],
  sort: WorkSort
): T[] =>
  items.toSorted(
    (a, b) =>
      (sort === "featured" ? groupRank[a.group] - groupRank[b.group] : 0) ||
      compare[sort](a, b)
  );

const finite = (value: string | undefined): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

export const workSortKeys = (
  data: Readonly<Record<string, string | undefined>>
): WorkSortKeys => ({
  featured: finite(data["featured"]),
  group: data["group"] === "products" ? "products" : "open-source",
  name: data["name"] ?? "",
  stars: finite(data["stars"]),
  updated: finite(data["updated"]),
});

export const updatedTime = (iso = ""): number => {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? 0 : time;
};
