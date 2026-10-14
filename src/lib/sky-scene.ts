import { deg } from "./math.ts";

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
const puffReach = 12_000;
const lookYawDegrees = 1.5;
const lookPitchShare = 0.35;
const lookRate = 4;

export const windGain = [25, 7.5, 45, 10] as const;

export const puffStrength = (puff: WorldPuff): number =>
  puff.age < puffRiseSeconds
    ? (puffPeak * puff.age) / puffRiseSeconds
    : puffPeak * Math.exp(-(puff.age - puffRiseSeconds) / puffSettleSeconds);

export const worldPuff = (
  ray: Vec3,
  eye: number,
  wind: readonly [number, number]
): WorldPuff => {
  const rise = Math.max(ray[1], 0.02);
  const reach = Math.min((cloudLayer - eye) / rise, puffReach);
  const flat = Math.hypot(ray[0], ray[2]) || 1;
  const along = Math.sqrt(Math.max(reach * reach - (cloudLayer - eye) ** 2, 0));
  return {
    age: 0,
    radius: 600 + reach * 0.06,
    x: (ray[0] / flat) * along + wind[0],
    z: (ray[2] / flat) * along + wind[1],
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
