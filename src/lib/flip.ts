import { stillQuery } from "./motion-pause.ts";

export interface Box {
  x: number;
  y: number;
}

export type Snapshot = ReadonlyMap<HTMLElement, Box | null>;

const flipMs = 420;

const flipEase = (): string =>
  getComputedStyle(document.documentElement)
    .getPropertyValue("--spring-slide")
    .trim() || "ease-out";

const boxOf = (item: HTMLElement): Box | null => {
  if (item.getClientRects().length === 0) return null;
  const { left, top } = item.getBoundingClientRect();
  return { x: left, y: top };
};

export const flipFrames = (
  before: Box | null,
  after: Box | null
): Keyframe[] | null => {
  if (!after) return null;
  if (!before) {
    return [
      { transform: "translateY(0.5rem) scale(0.98)" },
      { transform: "none" },
    ];
  }
  const x = Math.round(before.x - after.x);
  const y = Math.round(before.y - after.y);
  if (x === 0 && y === 0) return null;
  return [
    { transform: `translate(${String(x)}px, ${String(y)}px)` },
    { transform: "none" },
  ];
};

export const snapshot = (items: readonly HTMLElement[]): Snapshot =>
  new Map(items.map((item) => [item, boxOf(item)]));

export const playFlip = (before: Snapshot): void => {
  if (stillQuery().matches) return;
  const easing = flipEase();
  for (const [item, box] of before) {
    for (const animation of item.getAnimations()) animation.cancel();
    const frames = flipFrames(box, boxOf(item));
    if (frames) item.animate(frames, { duration: flipMs, easing });
  }
};
