import { deg, smoothstep } from "./math.ts";
import { earthRadius } from "./sky-view.ts";

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
export const cloudLayer = 2600;
const deckCell = 2400;
const puffShare = 0.5;
const lookYawDegrees = 2;
const lookPitchDegrees = 1.6;
const lookRollDegrees = 4.5;
const lookRate = 4;
const orbitSpeed = 2400;
const orbitSide = 0.9;
const orbitAhead = 0.45;
const orbitBoostMax = 7;
export const orbitWrap = 100_000_000;

export const windGain = [25, 7.5, 45, 10] as const;

export const puffStrength = (puff: WorldPuff): number =>
  puff.age < puffRiseSeconds
    ? (puffPeak * puff.age) / puffRiseSeconds
    : puffPeak * Math.exp(-(puff.age - puffRiseSeconds) / puffSettleSeconds);

const deckScale = (altitude: number): number =>
  1 + 7 * smoothstep(5000, 120_000, altitude);

export const worldPuff = (
  ray: Vec3,
  altitude: number,
  wind: readonly [number, number]
): undefined | WorldPuff => {
  const eyeRadius = earthRadius + altitude;
  const deckRadius = earthRadius + cloudLayer;
  const down = -ray[1];
  const flat = Math.hypot(ray[0], ray[2]);
  const limit = deckRadius / eyeRadius;
  if (down <= 0 || flat >= limit) return undefined;
  const distance =
    eyeRadius * (down - Math.sqrt(Math.max(limit * limit - flat * flat, 0)));
  const x = ray[0] * distance;
  const z = ray[2] * distance;
  const ring = Math.hypot(x, z) || 1;
  const reach = Math.atan2(ring, eyeRadius + ray[1] * distance) * earthRadius;
  return {
    age: 0,
    radius: deckCell * deckScale(altitude) * puffShare,
    x: (x / ring) * reach + wind[0],
    z: (z / ring) * reach + wind[1],
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

export type Look = [number, number, number];

export const lookTarget = (
  pointer: readonly [number, number] | undefined
): Look =>
  pointer
    ? [
        pointer[0] * lookYawDegrees * deg,
        -pointer[1] * lookPitchDegrees * deg,
        pointer[0] * lookRollDegrees * deg,
      ]
    : [0, 0, 0];

export const easeLook = (
  look: Look,
  target: Readonly<Look>,
  seconds: number
): boolean => {
  const e = 1 - Math.exp(-seconds * lookRate);
  let moving = false;
  for (const index of [0, 1, 2] as const) {
    look[index] += (target[index] - look[index]) * e;
    if (Math.abs(target[index] - look[index]) > 1e-5) moving = true;
  }
  return moving;
};

export const orbitBoost = (energy: number): number => {
  const e = Math.min(Math.max(energy, 0), 1);
  return orbitBoostMax * e * e * (3 - 2 * e);
};

export const orbitStep = (
  orbit: [number, number],
  yaw: number,
  seconds: number,
  boost: number
): void => {
  const reach = orbitSpeed * (1 + boost) * seconds;
  const sy = Math.sin(yaw);
  const cy = Math.cos(yaw);
  orbit[0] =
    (orbit[0] + reach * (cy * orbitSide + sy * orbitAhead)) % orbitWrap;
  orbit[1] =
    (orbit[1] + reach * (cy * orbitAhead - sy * orbitSide)) % orbitWrap;
};
