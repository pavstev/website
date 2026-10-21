import { clean, watchRouteFlag } from "./page-slide.ts";
import { workConfig } from "./work.ts";

const workPath = "/work";

const storyPaths = (): string[] =>
  Object.values(workConfig.repos.stories ?? {});

export const storyMorph = (fromPath: string, toPath: string): boolean => {
  const from = clean(fromPath);
  const to = clean(toPath);
  const stories = storyPaths();
  return (
    (from === workPath && stories.includes(to)) ||
    (to === workPath && stories.includes(from))
  );
};

export const watchStoryMorph = (): void => {
  watchRouteFlag("data-story-morph", (from, to) =>
    storyMorph(from, to) ? "" : undefined
  );
};
