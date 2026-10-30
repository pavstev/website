import type { Box } from "./tip-place.ts";

export type TapSide = "down" | "up" | undefined;

export const tapSides = (
  boxes: readonly Box[],
  tapHeight: number
): TapSide[] => {
  const sides: TapSide[] = boxes.map(() => undefined);
  const below = new Set<number>();
  const above = new Set<number>();
  for (const [i, upper] of boxes.entries()) {
    const reach = tapHeight - (upper.bottom - upper.top);
    for (const [j, lower] of boxes.entries()) {
      const gap = lower.top - upper.bottom;
      const overlap =
        Math.min(upper.right, lower.right) - Math.max(upper.left, lower.left);
      if (!(i !== j && overlap > 0 && gap >= -1 && gap < reach)) {
        continue;
      }

      below.add(i);
      above.add(j);
    }
  }
  for (const i of sides.keys()) {
    if (below.has(i) !== above.has(i)) sides[i] = below.has(i) ? "up" : "down";
  }
  return sides;
};

export const initTopicTaps = (bio: HTMLElement): (() => void) => {
  const place = (): void => {
    const triggers = [...bio.querySelectorAll<HTMLElement>(".topic-trigger")];
    const rem = Number(
      getComputedStyle(document.documentElement).fontSize.replace("px", "")
    );
    const sides = tapSides(
      triggers.map((t) => t.getBoundingClientRect()),
      rem * 2.75
    );
    for (const [i, trigger] of triggers.entries()) {
      const side = sides[i];
      if (side) trigger.dataset["tap"] = side;
      else delete trigger.dataset["tap"];
    }
  };
  const observer = new ResizeObserver(place);
  observer.observe(bio);
  void document.fonts.ready.then(place);
  return () => {
    observer.disconnect();
  };
};
