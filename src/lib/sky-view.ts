import { clamp, deg } from "./math.ts";

export type Basis = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export interface Sight {
  altitude: number;
  azimuth: number;
}

export interface SkyCamera {
  eye: number;
  horizon: number;
  top: number;
}

export interface ViewSize {
  card?: CardRect;
  height: number;
  width: number;
}

interface CardRect {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

type Vec3 = readonly [number, number, number];

const earthRadius = 6_371_000;
const eyeAltitude = 100_000;
const limbDip = Math.acos(earthRadius / (earthRadius + eyeAltitude));
const limbShare = 0.16;
const topShare = 0.04;
const halfWidthLimit = 0.9;
const solveSteps = 48;
const reachShare = 0.9;

const dot = (a: Vec3, b: Vec3): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const turn = (angle: number): number =>
  angle - 2 * Math.PI * Math.floor((angle + Math.PI) / (2 * Math.PI));

export const skyCamera = (width: number, height: number): SkyCamera => {
  const top = Math.min(
    1,
    (2 * halfWidthLimit * (1 - topShare) * height) / Math.max(width, 1)
  );
  const k = Math.tan(limbDip / 2) / top;
  return {
    eye: eyeAltitude,
    horizon: (limbShare + k) / (1 + k),
    top,
  };
};

const skyUnit = (camera: SkyCamera, height: number): number =>
  ((1 - camera.horizon) * height) / camera.top;

export const worldDirection = (altitude: number, azimuth: number): Vec3 => {
  const el = altitude * deg;
  const az = azimuth * deg;
  return [
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  ];
};

export const cameraBasis = (yaw: number, pitch: number, roll = 0): Basis => {
  const sy = Math.sin(yaw);
  const cy = Math.cos(yaw);
  const sp = Math.sin(pitch);
  const cp = Math.cos(pitch);
  const sr = Math.sin(roll);
  const cr = Math.cos(roll);
  const right: Vec3 = [cy, 0, -sy];
  const up: Vec3 = [-sy * sp, cp, -cy * sp];
  return [
    right[0] * cr + up[0] * sr,
    right[1] * cr + up[1] * sr,
    right[2] * cr + up[2] * sr,
    up[0] * cr - right[0] * sr,
    up[1] * cr - right[1] * sr,
    up[2] * cr - right[2] * sr,
    sy * cp,
    sp,
    cy * cp,
  ];
};

const column = (basis: Basis, index: 0 | 1 | 2): Vec3 => [
  basis[index * 3] ?? 0,
  basis[index * 3 + 1] ?? 0,
  basis[index * 3 + 2] ?? 0,
];

export const projectSky = (
  direction: Vec3,
  basis: Basis,
  camera: SkyCamera,
  width: number,
  height: number
): [number, number] | undefined => {
  const z = dot(direction, column(basis, 2));
  if (z <= -0.999) return undefined;
  const unit = skyUnit(camera, height);
  const u = dot(direction, column(basis, 0)) / (1 + z);
  const v = dot(direction, column(basis, 1)) / (1 + z);
  return [width / 2 + u * unit, height - camera.horizon * height - v * unit];
};

export const projectDisk = (
  direction: Vec3,
  angularRadius: number,
  basis: Basis,
  camera: SkyCamera,
  width: number,
  height: number
): readonly [number, number, number] | undefined => {
  const center = projectSky(direction, basis, camera, width, height);
  if (!center) return undefined;
  const z = dot(direction, column(basis, 2));
  return [
    center[0],
    center[1],
    (angularRadius * skyUnit(camera, height)) / (1 + z),
  ];
};

const offsetFor = (wanted: number, altitude: number): number => {
  const c = Math.cos(altitude * deg);
  const reach = (c / Math.sqrt(Math.max(1 - c * c, 1e-12))) * reachShare;
  const u = clamp(wanted, -reach, reach);
  const limit = Math.acos(clamp(-c, -1, 1)) * 0.999;
  let low = -limit;
  let high = limit;
  for (let i = 0; i < solveSteps; i += 1) {
    const mid = (low + high) / 2;
    const at = (Math.sin(mid) * c) / (1 + Math.cos(mid) * c);
    if (at < u) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
};

const sideMargin = (width: number): number => Math.max(24, width * 0.05);

const anchor = (view: ViewSize): number => {
  const { card, width } = view;
  if (!card) return width * 0.78;
  return Math.min(width - card.right, card.left) >= sideMargin(width) * 2
    ? (card.right + width) / 2
    : width - sideMargin(width) / 2;
};

export const aimYaw = (target: Sight, view: ViewSize): number => {
  const camera = skyCamera(view.width, view.height);
  const unit = skyUnit(camera, view.height);
  return turn(
    target.azimuth * deg -
      offsetFor((anchor(view) - view.width / 2) / unit, target.altitude)
  );
};
