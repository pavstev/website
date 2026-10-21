import { clamp01, smoothstep } from "../math.ts";

export interface StepOffset {
  height: number;
  top: number;
}

export interface StepPosition {
  index: number;
  t: number;
}

export interface TextRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

export const overlapsRect = (
  box: TextRect,
  text: TextRect,
  gap: number
): boolean =>
  box.left < text.left + text.width + gap &&
  box.left + box.width > text.left - gap &&
  box.top < text.top + text.height + gap &&
  box.top + box.height > text.top - gap;

const smooth = (x: number): number => smoothstep(0, 1, x);

export const stepAt = (
  scrollTop: number,
  offsets: readonly StepOffset[]
): StepPosition => {
  let index = 0;
  for (const [i, offset] of offsets.entries()) {
    if ((offset?.top ?? 0) <= scrollTop) index = i;
  }
  const step = offsets[index];
  if (!step) return { index: 0, t: 0 };
  const local = scrollTop - step.top;
  if (step.height <= 0) return { index, t: local >= 0 ? 1 : 0 };
  return { index, t: clamp01(local / step.height) };
};

export const easeToward = (
  current: number,
  target: number,
  dt: number,
  rate = 10
): number => current + (target - current) * (1 - Math.exp(-rate * dt));

export const splitProgress = (
  progress: number,
  count: number
): StepPosition => {
  if (count <= 0) return { index: 0, t: 0 };
  const clamped = Math.min(count, Math.max(0, progress));
  const index = Math.min(Math.floor(clamped), count - 1);
  return { index, t: clamped - index };
};

export const explodeAt = (t: number): number =>
  t < 0.5 ? 1 - 0.75 * smooth(t / 0.5) : 0.25 + 0.75 * smooth((t - 0.5) / 0.5);
