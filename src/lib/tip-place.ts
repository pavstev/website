export interface Blocker {
  box: Box;
  weight: number;
}

export interface Box {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export interface Placement {
  gap: number;
  shift: number;
  side: TipSide;
}

export interface PlaceRequest {
  align: TipAlign;
  anchor: Box;
  avoid: readonly Blocker[];
  height: number;
  side: TipSide;
  viewport: { height: number; width: number };
  width: number;
}

export type TipAlign = "center" | "end" | "start";

export type TipSide = "bottom" | "top";

const edgeGap = 8;
const tipGap = 7;
const minGap = 3;
const offscreenCost = 4;
const shiftReach = 0.35;

const overlaps = (span: Box, other: Box): boolean =>
  span.left < other.right &&
  span.right > other.left &&
  span.top - edgeGap < other.bottom &&
  span.bottom + edgeGap > other.top;

const costOf = (
  span: Box,
  room: number,
  blockers: readonly Blocker[]
): number =>
  (room < 0 ? offscreenCost : 0) +
  Math.max(
    0,
    ...blockers
      .filter(({ box }) => overlaps(span, box))
      .map(({ weight }) => weight)
  );

const leftOf = (anchor: Box, align: TipAlign, width: number): number => {
  if (align === "start") return anchor.left;
  return align === "end"
    ? anchor.right - width
    : (anchor.left + anchor.right) / 2 - width / 2;
};

const gapFor = (
  side: TipSide,
  anchor: Box,
  height: number,
  across: { left: number; right: number },
  blockers: readonly Blocker[]
): number => {
  let room = tipGap;
  for (const { box } of blockers) {
    if (box.left >= across.right || box.right <= across.left) continue;
    if (side === "top" && box.bottom <= anchor.top) {
      room = Math.min(room, anchor.top - box.bottom - edgeGap - height);
    }
    if (side === "bottom" && box.top >= anchor.bottom) {
      room = Math.min(room, box.top - anchor.bottom - edgeGap - height);
    }
  }
  return Math.round(Math.max(minGap, room));
};

export const placeTip = ({
  align,
  anchor,
  avoid,
  height,
  side,
  viewport,
  width,
}: PlaceRequest): Placement => {
  const left = leftOf(anchor, align, width);
  const right = left + width;
  const limit = viewport.width - edgeGap;
  let base = 0;
  if (left < edgeGap) base = edgeGap - left;
  else if (right > limit) base = limit - right;
  const reach = width * shiftReach;
  const fits = (shift: number): boolean =>
    Math.abs(shift) <= reach &&
    left + shift >= edgeGap &&
    right + shift <= limit;
  const roomAbove = anchor.top - tipGap - height - edgeGap;
  const roomBelow =
    viewport.height - edgeGap - (anchor.bottom + tipGap + height);
  const wanted = side === "top" ? roomAbove : roomBelow;
  const other = side === "top" ? roomBelow : roomAbove;
  const preferOther = wanted < 0 && other > wanted;
  let best: Placement & { score: number } = {
    gap: tipGap,
    score: Infinity,
    shift: base,
    side,
  };
  for (const candidate of [side, side === "top" ? "bottom" : "top"] as const) {
    const reachTop =
      candidate === "top"
        ? anchor.top - tipGap - height
        : anchor.bottom + minGap;
    const reachBottom =
      candidate === "top"
        ? anchor.top - minGap
        : anchor.bottom + tipGap + height;
    const shifts = [base];
    for (const { box } of avoid) {
      if (
        reachTop - edgeGap >= box.bottom ||
        reachBottom + edgeGap <= box.top
      ) {
        continue;
      }
      shifts.push(box.right + edgeGap - left, box.left - edgeGap - right);
    }
    for (const shift of shifts) {
      if (shift !== base && !fits(shift)) continue;
      const across = { left: left + shift, right: right + shift };
      const gap = gapFor(candidate, anchor, height, across, avoid);
      const top =
        candidate === "top" ? anchor.top - gap - height : anchor.bottom + gap;
      const bottom = top + height;
      const room =
        candidate === "top"
          ? top - edgeGap
          : viewport.height - edgeGap - bottom;
      const cost = costOf({ ...across, bottom, top }, room, avoid);
      const score =
        cost * width +
        Math.abs(shift - base) +
        ((candidate !== side) === preferOther ? 0 : 0.5);
      if (score < best.score) best = { gap, score, shift, side: candidate };
    }
  }
  return { gap: best.gap, shift: Math.round(best.shift), side: best.side };
};
