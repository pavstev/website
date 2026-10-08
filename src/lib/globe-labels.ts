export interface LabelBox {
  height: number;
  key: string;
  width: number;
  x: number;
  y: number;
}

const clashes = (a: LabelBox, b: LabelBox, gap: number): boolean =>
  a.x < b.x + b.width + gap &&
  b.x < a.x + a.width + gap &&
  a.y < b.y + b.height + gap &&
  b.y < a.y + a.height + gap;

export const placeLabels = (
  boxes: readonly LabelBox[],
  width: number,
  height: number,
  gap: number
): Set<string> => {
  const kept: LabelBox[] = [];
  for (const box of boxes) {
    const inside =
      box.x >= 0 &&
      box.y >= 0 &&
      box.x + box.width <= width &&
      box.y + box.height <= height;
    if (inside && kept.every((other) => !clashes(box, other, gap))) {
      kept.push(box);
    }
  }
  return new Set(kept.map((box) => box.key));
};
