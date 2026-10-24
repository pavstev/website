export const storyEvent = "sky:story";

let chapter = 0;

export const storyChapter = (): number => chapter;

export const setStoryChapter = (value: number): void => {
  if (value === chapter || !Number.isFinite(value)) return;
  chapter = value;
  document.dispatchEvent(new CustomEvent(storyEvent));
};
