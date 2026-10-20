import { type CardRect } from "./sky-view.ts";

export type ClearUniform = [number, number, number, number];

const empty: ClearUniform = [0, 0, 0, 0];

export const clearBox = (
  card: CardRect,
  texts: readonly CardRect[]
): CardRect => {
  const wide = texts.filter((text) => text.right > text.left);
  if (wide.length === 0) return card;
  return {
    bottom: card.bottom,
    left: Math.min(...wide.map((text) => text.left)),
    right: Math.max(...wide.map((text) => text.right)),
    top: card.top,
  };
};

export const clearUniform = (
  box: CardRect | undefined,
  viewHeight: number,
  scale: number
): ClearUniform => {
  if (!box || box.right <= box.left || box.bottom <= box.top) return empty;
  return [
    box.left * scale,
    (viewHeight - box.bottom) * scale,
    box.right * scale,
    (viewHeight - box.top) * scale,
  ];
};
