import { clamp, deg } from "./math.ts";
import { moonPosition, sunPosition } from "./sky-ephemeris.ts";

export interface Aim {
  kind: AimKind;
  second?: Sight;
  target: Sight;
}

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

type AimKind = "moon" | "rise" | "sun" | "twilight";

interface CardRect {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

interface Sight {
  altitude: number;
  azimuth: number;
}

type Vec3 = readonly [number, number, number];

export const earthRadius = 6_371_000;
export const eyeAltitude = 100_000;
export const limbDip = Math.acos(earthRadius / (earthRadius + eyeAltitude));
const limbShare = 0.16;
const topShare = 0.04;
const topMargin = 24;
const halfWidthLimit = 0.9;
const diskGainMax = 7.5;
const eclipseRoom = 0.95;
const riseStepMs = 600_000;
const riseSpanMs = 36 * 3_600_000;
const twilightDepth = -18;
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

export const skyRay = (
  x: number,
  y: number,
  basis: Basis,
  camera: SkyCamera,
  width: number,
  height: number
): Vec3 => {
  const unit = skyUnit(camera, height);
  const u = (x - width / 2) / unit;
  const v = (height - camera.horizon * height - y) / unit;
  const r2 = u * u + v * v;
  const a = (2 * u) / (1 + r2);
  const b = (2 * v) / (1 + r2);
  const c = (1 - r2) / (1 + r2);
  const right = column(basis, 0);
  const up = column(basis, 1);
  const forward = column(basis, 2);
  return [
    right[0] * a + up[0] * b + forward[0] * c,
    right[1] * a + up[1] * b + forward[1] * c,
    right[2] * a + up[2] * b + forward[2] * c,
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

const anchors = (view: ViewSize): [number, number] => {
  const { card, width } = view;
  if (card) {
    const room = Math.min(width - card.right, card.left);
    if (room >= sideMargin(width) * 2)
      return [(card.right + width) / 2, card.left / 2];
  }
  return [width * 0.78, width * 0.22];
};

const onScreen = (
  point: [number, number] | undefined,
  view: ViewSize
): boolean => {
  if (!point) return false;
  const margin = sideMargin(view.width);
  return (
    point[0] > margin &&
    point[0] < view.width - margin &&
    point[1] > topMargin &&
    point[1] < view.height
  );
};

export const aimYaw = (aim: Aim, view: ViewSize): number => {
  const camera = skyCamera(view.width, view.height);
  const unit = skyUnit(camera, view.height);
  const [preferred, other] = anchors(view).map((x) =>
    turn(
      aim.target.azimuth * deg -
        offsetFor((x - view.width / 2) / unit, aim.target.altitude)
    )
  ) as [number, number];
  const { second } = aim;
  if (!second) return preferred;
  const shows = (yaw: number): boolean =>
    onScreen(
      projectSky(
        worldDirection(second.altitude, second.azimuth),
        cameraBasis(yaw, 0),
        camera,
        view.width,
        view.height
      ),
      view
    );
  return shows(preferred) || !shows(other) ? preferred : other;
};

export const aimHolds = (yaw: number, aim: Aim, view: ViewSize): boolean => {
  const camera = skyCamera(view.width, view.height);
  const point = projectSky(
    worldDirection(aim.target.altitude, aim.target.azimuth),
    cameraBasis(yaw, 0),
    camera,
    view.width,
    view.height
  );
  if (!point || !onScreen(point, view)) return false;
  const { card } = view;
  if (!card) return true;
  const room = Math.min(view.width - card.right, card.left);
  return (
    room < sideMargin(view.width) * 2 ||
    point[0] < card.left ||
    point[0] > card.right
  );
};

const sightOf = (position: { altitude: number; azimuth: number }): Sight => ({
  altitude: position.altitude,
  azimuth: position.azimuth,
});

const limbDepth = -limbDip / deg;

const nextRise = (
  instant: number,
  latitude: number,
  longitude: number
): number => {
  for (let at = instant; at <= instant + riseSpanMs; at += riseStepMs) {
    const sun = sunPosition(at, latitude, longitude);
    if (sun.altitude + sun.angularRadius > limbDepth) return sun.azimuth;
    const moon = moonPosition(at, latitude, longitude);
    if (moon.altitude + moon.angularRadius > limbDepth) return moon.azimuth;
  }
  return sunPosition(instant, latitude, longitude).azimuth;
};

export const frameAim = (
  instant: number,
  latitude: number,
  longitude: number
): Aim => {
  const sun = sunPosition(instant, latitude, longitude);
  const moon = moonPosition(instant, latitude, longitude);
  const sunUp = sun.altitude + sun.angularRadius > limbDepth;
  const moonUp = moon.altitude + moon.angularRadius > limbDepth;
  if (sunUp)
    return moonUp
      ? { kind: "sun", second: sightOf(moon), target: sightOf(sun) }
      : { kind: "sun", target: sightOf(sun) };
  if (moonUp) return { kind: "moon", target: sightOf(moon) };
  if (sun.altitude > twilightDepth)
    return { kind: "twilight", target: { altitude: 0, azimuth: sun.azimuth } };
  return {
    kind: "rise",
    target: { altitude: 0, azimuth: nextRise(instant, latitude, longitude) },
  };
};

export const diskGain = (
  sun: Vec3,
  moon: Vec3,
  sunRadius: number,
  moonRadius: number
): number => {
  const separation = Math.acos(clamp(dot(sun, moon), -1, 1));
  return clamp(
    (separation * eclipseRoom) / Math.max(sunRadius + moonRadius, 1e-6),
    1,
    diskGainMax
  );
};
