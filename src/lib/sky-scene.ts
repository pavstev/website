import type { LandmarkMeta } from "./skyline.ts";

import { deg } from "./math.ts";
import { eyeHeight, fieldOfView, horizonShare } from "./sky-light.ts";
import { viewportFocal } from "./sky-path.ts";

export const landmarkCount = 16;

export interface Hover {
  id: number;
  side: number;
}

export interface SceneCamera {
  eye: number;
  focal: number;
  horizon: number;
}

export interface WorldPuff {
  age: number;
  radius: number;
  x: number;
  z: number;
}

type Vec3 = readonly [number, number, number];

const puffSlots = 6;
const puffRiseSeconds = 0.7;
const puffPeak = 0.9;
const puffSettleSeconds = 4;
const puffFloor = 0.01;
const cloudBase = 1500;
const puffReach = 9000;
const landmarkScale = 1.1;
const hoverPad = 6;
const leanDegrees = 2.5;
const lookYawDegrees = 1.5;
const lookPitchShare = 0.35;
const lookRate = 4;
const leanRate = 6;

export const windGain = [25, 7.5, 45, 10] as const;

export const cameraFor = (width: number, height: number): SceneCamera => ({
  eye: eyeHeight,
  focal: viewportFocal(fieldOfView),
  horizon: horizonShare(width, height),
});

export const puffStrength = (puff: WorldPuff): number =>
  puff.age < puffRiseSeconds
    ? (puffPeak * puff.age) / puffRiseSeconds
    : puffPeak * Math.exp(-(puff.age - puffRiseSeconds) / puffSettleSeconds);

export const worldPuff = (
  x: number,
  y: number,
  aspect: number,
  camera: SceneCamera,
  wind: readonly [number, number]
): WorldPuff => {
  const dx = (x - 0.5) * aspect;
  const dy = Math.max(1 - y - camera.horizon, 0.02);
  const length = Math.hypot(dx, dy, camera.focal);
  const reach = Math.min((cloudBase - camera.eye) / (dy / length), puffReach);
  return {
    age: 0,
    radius: 500 + reach * 0.06,
    x: (dx / length) * reach + wind[0],
    z: (camera.focal / length) * reach + wind[1],
  };
};

export const addWorldPuff = (
  puffs: readonly WorldPuff[],
  puff: WorldPuff
): WorldPuff[] =>
  [...puffs, puff]
    .toSorted((a, b) => puffStrength(b) - puffStrength(a))
    .slice(0, puffSlots);

export const agePuffs = (
  puffs: readonly WorldPuff[],
  seconds: number
): WorldPuff[] =>
  puffs
    .map((puff) => ({ ...puff, age: puff.age + seconds }))
    .filter(
      (puff) => puff.age < puffRiseSeconds || puffStrength(puff) > puffFloor
    );

export const puffUniforms = (
  puffs: readonly WorldPuff[]
): Float32Array<ArrayBuffer> => {
  const data = new Float32Array(puffSlots * 4);
  for (const [index, puff] of puffs.slice(0, puffSlots).entries())
    data.set([puff.x, puff.z, puff.radius, puffStrength(puff)], index * 4);
  return data;
};

export const projectPoint = (
  point: Vec3,
  camera: SceneCamera,
  look: readonly [number, number],
  width: number,
  height: number
): [number, number] | undefined => {
  let v: Vec3 = [point[0], point[1] - camera.eye, point[2]];
  const cy = Math.cos(look[0]);
  const sy = Math.sin(look[0]);
  v = [cy * v[0] - sy * v[2], v[1], sy * v[0] + cy * v[2]];
  const cp = Math.cos(look[1]);
  const sp = Math.sin(look[1]);
  v = [v[0], cp * v[1] - sp * v[2], sp * v[1] + cp * v[2]];
  if (v[2] <= 1) return undefined;
  return [
    width / 2 + ((camera.focal * v[0]) / v[2]) * height,
    height - (camera.horizon + (camera.focal * v[1]) / v[2]) * height,
  ];
};

export const pickLandmark = (
  landmarks: readonly LandmarkMeta[],
  camera: SceneCamera,
  look: readonly [number, number],
  pointer: readonly [number, number],
  width: number,
  height: number
): Hover | undefined => {
  let best = Infinity;
  let hover: Hover | undefined;
  for (const meta of landmarks) {
    const [ax, ay, az, bx, by, bz] = meta.box;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const cx of [ax, bx])
      for (const cy of [ay, by])
        for (const cz of [az, bz]) {
          const q = projectPoint(
            [
              meta.x + (cx - meta.x) * landmarkScale,
              cy * landmarkScale,
              meta.z + (cz - meta.z) * landmarkScale,
            ],
            camera,
            look,
            width,
            height
          );
          if (!q) continue;
          x0 = Math.min(x0, q[0]);
          x1 = Math.max(x1, q[0]);
          y0 = Math.min(y0, q[1]);
          y1 = Math.max(y1, q[1]);
        }
    const inside =
      pointer[0] > x0 - hoverPad &&
      pointer[0] < x1 + hoverPad &&
      pointer[1] > y0 - hoverPad &&
      pointer[1] < y1 + hoverPad;
    const area = (x1 - x0) * (y1 - y0);
    if (!(inside && area < best)) {
      continue;
    }

    best = area;
    hover = { id: meta.id, side: pointer[0] < (x0 + x1) / 2 ? 1 : -1 };
  }
  return hover;
};

export const lookTarget = (
  pointer: readonly [number, number] | undefined
): [number, number] =>
  pointer
    ? [
        pointer[0] * lookYawDegrees * deg,
        -pointer[1] * lookYawDegrees * lookPitchShare * deg,
      ]
    : [0, 0];

export const easeLook = (
  look: [number, number],
  target: readonly [number, number],
  seconds: number
): boolean => {
  const e = 1 - Math.exp(-seconds * lookRate);
  look[0] += (target[0] - look[0]) * e;
  look[1] += (target[1] - look[1]) * e;
  return (
    Math.abs(target[0] - look[0]) > 1e-5 || Math.abs(target[1] - look[1]) > 1e-5
  );
};

export const landmarkUniforms = (
  landmarks: readonly LandmarkMeta[]
): Float32Array<ArrayBuffer> => {
  const data = new Float32Array(landmarkCount * 4);
  for (const meta of landmarks) data.set([meta.x, meta.z, 0, 0], meta.id * 4);
  return data;
};

export const easeLean = (
  data: Float32Array,
  hover: Hover | undefined,
  seconds: number
): boolean => {
  const e = 1 - Math.exp(-seconds * leanRate);
  let moving = false;
  for (let id = 0; id < landmarkCount; id += 1) {
    const on = hover?.id === id;
    const lean = on ? leanDegrees * deg * hover.side * 0.6 : 0;
    const lift = on ? leanDegrees * 4 : 0;
    const nowLean = data[id * 4 + 2] ?? 0;
    const nowLift = data[id * 4 + 3] ?? 0;
    const nextLean = nowLean + (lean - nowLean) * e;
    const nextLift = nowLift + (lift - nowLift) * e;
    data[id * 4 + 2] = nextLean;
    data[id * 4 + 3] = nextLift;
    if (Math.abs(lean - nextLean) > 1e-4 || Math.abs(lift - nextLift) > 0.01)
      moving = true;
  }
  return moving;
};

export const settleLean = (data: Float32Array): void => {
  for (let id = 0; id < landmarkCount; id += 1) {
    data[id * 4 + 2] = 0;
    data[id * 4 + 3] = 0;
  }
};
