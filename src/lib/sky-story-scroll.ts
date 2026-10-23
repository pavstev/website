import { stillQuery } from "./motion-pause.ts";
import { setStoryChapter } from "./sky-story-store.ts";

export interface ReadBox {
  height: number;
  top: number;
}

export interface ReadView {
  bar: number;
  line: number;
  view: number;
}

const readLine = 0.88;

export const chapterAt = (y: number, spots: readonly number[]): number => {
  const last = spots.length - 1;
  const first = spots[0];
  if (first === undefined || last < 1 || y <= first) return 0;
  if (y >= (spots[last] ?? first)) return last;
  let index = 0;
  while (index < last - 1 && y >= (spots[index + 1] ?? Infinity)) index += 1;
  const from = spots[index] ?? first;
  const to = spots[index + 1] ?? from;
  return index + (to > from ? (y - from) / (to - from) : 1);
};

export const snapChapter = (chapter: number): number => Math.round(chapter);

export const readSpot = (box: ReadBox, view: ReadView): number =>
  Math.min(box.top + box.height - view.line * view.view, box.top - view.bar);

export const steadySpots = (
  spots: readonly number[],
  max = Infinity
): number[] => {
  let floor = 0;
  return spots.map((spot) => {
    floor = Math.max(floor, Math.min(spot, max));
    return floor;
  });
};

const pageTop = (element: HTMLElement): number => {
  let top = 0;
  let node: Element | null = element;
  while (node instanceof HTMLElement) {
    top += node.offsetTop;
    node = node.offsetParent;
  }
  return top;
};

export const mountSkyStory = (root: HTMLElement): (() => void) => {
  const bodies = [
    ...root.querySelectorAll<HTMLElement>(":scope .sky-step .sky-step-body"),
  ];
  const list = root.querySelector<HTMLElement>(":scope .sky-steps");
  if (!list || bodies.length < 2) return () => undefined;
  const bar = document.querySelector<HTMLElement>("[data-blog-bar]");
  const still = stillQuery();
  const listeners = new AbortController();
  let spots: number[] = [];
  let frame = 0;
  let disposed = false;

  const publish = (): void => {
    const chapter = chapterAt(window.scrollY, spots);
    setStoryChapter(still.matches ? snapChapter(chapter) : chapter);
  };

  const measure = (): void => {
    const view = {
      bar: bar?.offsetHeight ?? 0,
      line: readLine,
      view: document.documentElement.clientHeight,
    };
    spots = steadySpots(
      bodies.map((body) =>
        readSpot({ height: body.offsetHeight, top: pageTop(body) }, view)
      ),
      document.documentElement.scrollHeight - view.view
    );
    publish();
  };

  const onFrame = (): void => {
    frame = 0;
    if (!disposed) publish();
  };

  const onScroll = (): void => {
    if (frame === 0) frame = globalThis.requestAnimationFrame(onFrame);
  };

  const watchSize = new ResizeObserver(measure);
  const { signal } = listeners;
  measure();
  window.addEventListener("scroll", onScroll, { passive: true, signal });
  still.addEventListener("change", publish);
  watchSize.observe(list);
  for (const body of bodies) watchSize.observe(body);
  void document.fonts.ready.then(() => {
    if (!disposed) measure();
  });

  return (): void => {
    if (disposed) return;
    disposed = true;
    globalThis.cancelAnimationFrame(frame);
    listeners.abort();
    still.removeEventListener("change", publish);
    watchSize.disconnect();
  };
};
