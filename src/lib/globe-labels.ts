export interface LabelAnchor {
  height: number;
  key: string;
  offset: number;
  radius: number;
  width: number;
  x: number;
  y: number;
}

export type LabelSide = "above" | "below" | "left" | "right";

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

const sides: readonly LabelSide[] = ["right", "left", "above", "below"];
const keepShare = 0.75;

const fit = (value: number, room: number): number =>
  Math.min(Math.max(value, 0), Math.max(0, room));

const overlap = (a: Box, b: Box): number =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

const corner = (anchor: LabelAnchor, side: LabelSide): [number, number] => {
  switch (side) {
    case "above": {
      return [
        anchor.x - anchor.width / 2,
        anchor.y - anchor.offset - anchor.height,
      ];
    }
    case "below": {
      return [anchor.x - anchor.width / 2, anchor.y + anchor.offset];
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
  previous: ReadonlyMap<string, LabelSide> = new Map()
): PlacedLabel[] => {
  const dots: Box[] = anchors.map((anchor) => ({
    bottom: anchor.y + anchor.radius,
    left: anchor.x - anchor.radius,
    right: anchor.x + anchor.radius,
    top: anchor.y - anchor.radius,
  }));
  const taken: Box[] = [];

  const measure = (anchor: LabelAnchor, side: LabelSide): Option => {
    const [wantX, wantY] = corner(anchor, side);
    const x = fit(wantX, width - anchor.width);
    const y = fit(wantY, height - anchor.height);
    const box = {
      bottom: y + anchor.height,
      left: x,
      right: x + anchor.width,
      top: y,
    };
    const near = {
      bottom: box.bottom + gap,
      left: box.left - gap,
      right: box.right + gap,
      top: box.top - gap,
    };
    let cost = (Math.abs(x - wantX) + Math.abs(y - wantY)) * anchor.height;
    for (const other of taken) cost += overlap(near, other);
    for (const dot of dots) cost += overlap(box, dot);
    return { box, cost, side };
  };

  return anchors.map((anchor) => {
    const kept = previous.get(anchor.key);
    const first = measure(anchor, kept ?? "right");
    let best = first;
    for (const side of sides) {
      if (side === first.side) continue;
      const option = measure(anchor, side);
      if (option.cost < best.cost) best = option;
    }
    const chosen =
      kept !== undefined && best.cost >= first.cost * keepShare - 1
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
