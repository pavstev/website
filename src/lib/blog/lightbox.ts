export interface Box {
  height: number;
  left: number;
  top: number;
  width: number;
}

export interface Landing {
  dx: number;
  dy: number;
  scale: number;
}

export const nearHome = 1.02;
export const snapHome = 1.05;
const tapSlop = 8;
export const swipeDistance = 72;

export const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

export const panLimit = (
  content: number,
  frame: number,
  scale: number
): number => Math.max(0, (content * scale - frame) / 2);

export const isTap = (dx: number, dy: number): boolean =>
  Math.hypot(dx, dy) < tapSlop;

export const isSwipe = (dx: number, dy: number, scale: number): boolean =>
  scale <= nearHome && Math.hypot(dx, dy) >= swipeDistance;

export const landing = (
  frame: Box,
  origin: Box,
  contentWidth: number
): Landing | null => {
  if (origin.width <= 0 || contentWidth <= 0) return null;
  return {
    dx: origin.left + origin.width / 2 - (frame.left + frame.width / 2),
    dy: origin.top + origin.height / 2 - (frame.top + frame.height / 2),
    scale: origin.width / contentWidth,
  };
};
