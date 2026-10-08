export interface LabelAnchor {
  height: number;
  key: string;
  offset: number;
  radius: number;
  width: number;
  x: number;
  y: number;
}

export interface LabelRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

export type LabelSide =
  | "above"
  | "aboveLeft"
  | "aboveRight"
  | "below"
  | "belowLeft"
  | "belowRight"
  | "left"
  | "right";

export interface PlacedLabel {
  key: string;
  side: LabelSide;
  x: number;
  y: number;
}

interface Box {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

interface Option {
  box: Box;
  cost: number;
  side: LabelSide;
}

const sides: readonly LabelSide[] = [
  "right",
  "left",
  "above",
  "below",
  "aboveRight",
  "belowRight",
  "aboveLeft",
  "belowLeft",
];
const keepShare = 0.75;
const slant = 0.6;
const tie = 1e-6;
const wallWeight = 4;

const fit = (value: number, room: number): number =>
  Math.min(Math.max(value, 0), Math.max(0, room));

const overlap = (a: Box, b: Box): number =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

const grow = (box: Box, by: number): Box => ({
  bottom: box.bottom + by,
  left: box.left - by,
  right: box.right + by,
  top: box.top - by,
});

const origin = (anchor: LabelAnchor, side: LabelSide): [number, number] => {
  const step = anchor.offset * slant;
  switch (side) {
    case "above": {
      return [
        anchor.x - anchor.width / 2,
        anchor.y - anchor.offset - anchor.height,
      ];
    }
    case "aboveLeft": {
      return [anchor.x - step - anchor.width, anchor.y - step - anchor.height];
    }
    case "aboveRight": {
      return [anchor.x + step, anchor.y - step - anchor.height];
    }
    case "below": {
      return [anchor.x - anchor.width / 2, anchor.y + anchor.offset];
    }
    case "belowLeft": {
      return [anchor.x - step - anchor.width, anchor.y + step];
    }
    case "belowRight": {
      return [anchor.x + step, anchor.y + step];
    }
    case "left": {
      return [
        anchor.x - anchor.offset - anchor.width,
        anchor.y - anchor.height / 2,
      ];
    }
    case "right": {
      return [anchor.x + anchor.offset, anchor.y - anchor.height / 2];
    }
  }
};

export const placeLabels = (
  anchors: readonly LabelAnchor[],
  width: number,
  height: number,
  gap: number,
  previous: ReadonlyMap<string, LabelSide> = new Map(),
  blocked: readonly LabelRect[] = []
): PlacedLabel[] => {
  const dots: Box[] = anchors.map((anchor) => ({
    bottom: anchor.y + anchor.radius,
    left: anchor.x - anchor.radius,
    right: anchor.x + anchor.radius,
    top: anchor.y - anchor.radius,
  }));
  const walls: Box[] = blocked.map((rect) => ({
    bottom: rect.y + rect.height,
    left: rect.x,
    right: rect.x + rect.width,
    top: rect.y,
  }));
  const taken: Box[] = [];

  const spot = (
    anchor: LabelAnchor,
    side: LabelSide,
    want: [number, number],
    at: [number, number]
  ): Option => {
    const x = fit(at[0], width - anchor.width);
    const y = fit(at[1], height - anchor.height);
    const box = {
      bottom: y + anchor.height,
      left: x,
      right: x + anchor.width,
      top: y,
    };
    const near = grow(box, gap);
    let cost = (Math.abs(x - want[0]) + Math.abs(y - want[1])) * anchor.height;
    for (const other of taken) cost += overlap(near, other);
    for (const wall of walls) {
      cost += overlap(near, wall) + overlap(box, wall) * (wallWeight - 1);
    }
    for (const dot of dots) cost += overlap(box, dot);
    return { box, cost, side };
  };

  const measure = (anchor: LabelAnchor, side: LabelSide): Option => {
    const want = origin(anchor, side);
    const plain = spot(anchor, side, want, want);
    const { box } = plain;
    let best = plain;
    for (const wall of walls) {
      if (overlap(grow(box, gap), wall) === 0) continue;
      const exits: Array<[number, number]> = [
        [wall.left - gap - anchor.width, box.top],
        [wall.right + gap, box.top],
        [box.left, wall.top - gap - anchor.height],
        [box.left, wall.bottom + gap],
      ];
      for (const exit of exits) {
        const option = spot(anchor, side, want, exit);
        if (option.cost < best.cost - tie) best = option;
      }
    }
    return best;
  };

  return anchors.map((anchor) => {
    const kept = previous.get(anchor.key);
    const first = measure(anchor, kept ?? "right");
    let best = first;
    for (const side of sides) {
      if (side === first.side) continue;
      const option = measure(anchor, side);
      if (option.cost < best.cost - tie) best = option;
    }
    const chosen =
      kept !== undefined &&
      best.cost >= first.cost * keepShare - anchor.height * gap
        ? first
        : best;
    taken.push(chosen.box);
    return {
      key: anchor.key,
      side: chosen.side,
      x: chosen.box.left,
      y: chosen.box.top,
    };
  });
};
