interface MeteorPath {
  angle: number;
  x: number;
  y: number;
}

const rayViewShare = 0.72;
const rayViewMaxCss = 960;
const meteorRoom = 0.55;

export const cornerMeteor: Readonly<MeteorPath> = {
  angle: -0.4,
  x: 0.3,
  y: 0.38,
};

export const rayView = (heightCss: number): number =>
  Math.min(heightCss * rayViewShare, rayViewMaxCss);

export const meteorStart = (
  widthPx: number,
  heightPx: number,
  view: number
): MeteorPath => ({
  angle: cornerMeteor.angle,
  x: Math.min(cornerMeteor.x, widthPx / view / 2 - meteorRoom),
  y: heightPx / view / 2 - (0.5 - cornerMeteor.y),
});
