import { clean, watchRouteFlag } from "./page-slide.ts";
import { workConfig } from "./work.ts";

const workPath = "/work";

const stagedStories = new Set(["dotfiles"]);

const storyPaths = (): string[] =>
  Object.entries(workConfig.repos.stories ?? {})
    .filter(([key]) => stagedStories.has(key))
    .map(([, path]) => path);

export type StoryMorph = "in" | "out";

export const storyMorph = (
  fromPath: string,
  toPath: string
): StoryMorph | undefined => {
  const from = clean(fromPath);
  const to = clean(toPath);
  const stories = storyPaths();
  if (from === workPath && stories.includes(to)) return "in";
  return to === workPath && stories.includes(from) ? "out" : undefined;
};

export const watchStoryMorph = (): void => {
  watchRouteFlag("data-story-morph", storyMorph);
};
