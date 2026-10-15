export const readRatio = (
  top: number,
  height: number,
  viewport: number
): number => {
  if (height <= viewport) return top < 0 ? 1 : 0;
  return Math.min(1, Math.max(0, -top / (height - viewport)));
};
