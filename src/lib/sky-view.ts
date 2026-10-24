export interface CardRect {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface Sight {
  altitude: number;
  azimuth: number;
}

export interface ViewSize {
  card?: CardRect;
  height: number;
  horizon?: number;
  width: number;
}

const viewDegrees = 90;
export const horizonShare = 0.02;

export const turnDegrees = (angle: number): number =>
  ((((angle + 180) % 360) + 360) % 360) - 180;

export const pixelsPerDegree = (
  height: number,
  horizon: number = horizonShare
): number => ((1 - horizon) * height) / viewDegrees;

export const horizonHeight = (
  height: number,
  horizon: number = horizonShare
): number => horizon * height;

const sideMargin = (width: number): number => Math.max(24, width * 0.05);

export const anchorX = (view: ViewSize): number => {
  const { card, width } = view;
  if (!card) return width * 0.78;
  return Math.min(width - card.right, card.left) >= sideMargin(width) * 2
    ? (card.right + width) / 2
    : width - sideMargin(width) / 2;
};

export const aimAzimuth = (target: Sight, view: ViewSize): number =>
  target.azimuth -
  (anchorX(view) - view.width / 2) / pixelsPerDegree(view.height, view.horizon);

export const blendAim = (day: number, night: number, share: number): number =>
  day + turnDegrees(night - day) * share;

export const projectSight = (
  sight: Sight,
  center: number,
  view: ViewSize
): ScreenPoint => {
  const scale = pixelsPerDegree(view.height, view.horizon);
  return {
    x: view.width / 2 + turnDegrees(sight.azimuth - center) * scale,
    y: horizonHeight(view.height, view.horizon) + sight.altitude * scale,
  };
};
