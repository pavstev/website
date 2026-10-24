import { ditherTones } from "./theme.ts";

const referenceRadius = 120;
export const cellCssPx = 2;
export const lensZoom = 1.6;
export const lensRadiusShare = 72 / referenceRadius;
export const haloBandShare = 16 / referenceRadius;
export const dialogCellScale = 1.5;
export const outlineAlpha = 0.95;
export const lensHaloAlpha = 0.55;
export const haloFps = 15;

const bayerMatrix = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const toneSpread = 0.9;
const haloAlphaFloor = 0.35;
const haloAlphaRange = 0.5;

export const bayerThreshold = (gx: number, gy: number): number =>
  ((bayerMatrix[((gy & 3) << 2) | (gx & 3)] ?? 0) + 0.5) / bayerMatrix.length;

export const toneIndex = (luma: number, threshold: number): number =>
  Math.min(
    ditherTones.length - 1,
    Math.max(
      0,
      Math.round(
        luma * (ditherTones.length - 1) + (threshold - 0.5) * toneSpread
      )
    )
  );

export const pickTone = (luma: number, threshold: number): string =>
  ditherTones[toneIndex(luma, threshold)] ?? ditherTones[0];

export const cellInCircle = (
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  radius: number
): boolean => Math.hypot(x - centerX, y - centerY) <= radius;

export const haloFalloff = (
  distance: number,
  radius: number,
  band: number
): number =>
  distance < radius || distance > radius + band
    ? 0
    : 1 - (distance - radius) / band;

export const outlineHit = (
  distance: number,
  radius: number,
  cell: number
): boolean => distance >= radius - cell / 2 && distance < radius + cell / 2;

export type LensRing = "halo" | "outline" | undefined;

export const lensRing = (
  distance: number,
  radius: number,
  cell: number,
  threshold: number
): LensRing => {
  if (distance <= radius || distance > radius + cell * 3) return undefined;
  if (distance <= radius + cell) return "outline";
  return 1 - (distance - radius - cell) / (cell * 2) > threshold
    ? "halo"
    : undefined;
};

export const haloPulse = (seconds: number, depth: number): number =>
  0.85 + 0.15 * Math.sin(1.2 * seconds - depth * 0.05);

export const haloLit = (
  falloff: number,
  pulse: number,
  threshold: number
): boolean => falloff > 0 && falloff * pulse > threshold;

export const haloAlpha = (falloff: number): number =>
  haloAlphaFloor + haloAlphaRange * falloff;

export const lumaOf = (r: number, g: number, b: number): number =>
  (0.299 * r + 0.587 * g + 0.114 * b) / 255;

export interface RimCells {
  alpha: Float32Array;
  depth: Float32Array;
  edgeX: Float32Array;
  edgeY: Float32Array;
  falloff: Float32Array;
  margin: number;
  side: number;
  size: number;
  threshold: Float32Array;
  x: Float32Array;
  y: Float32Array;
}

export const rimCells = (
  width: number,
  ratio: number,
  cellScale: number
): RimCells => {
  const photo = (width * ratio) / 2;
  const band = haloBandShare * photo;
  const cell = Math.max(1, Math.round(cellCssPx * cellScale * ratio));
  const margin =
    Math.ceil(haloBandShare * (width / 2) + (cell / ratio) * 1.5) + 2;
  const side = Math.round((width + margin * 2) * ratio);
  const center = side / 2;
  const inner = photo + cell / 2;
  const edgeX: number[] = [];
  const edgeY: number[] = [];
  const alpha: number[] = [];
  const depth: number[] = [];
  const falloff: number[] = [];
  const threshold: number[] = [];
  const x: number[] = [];
  const y: number[] = [];
  const count = Math.ceil(side / cell);
  for (let gy = 0; gy < count; gy++) {
    for (let gx = 0; gx < count; gx++) {
      const distance = Math.hypot(
        gx * cell + cell / 2 - center,
        gy * cell + cell / 2 - center
      );
      if (outlineHit(distance, photo, cell)) {
        edgeX.push(gx * cell);
        edgeY.push(gy * cell);
        continue;
      }
      const level = haloFalloff(distance, inner, band);
      if (level === 0) continue;
      alpha.push(haloAlpha(level));
      depth.push((distance / photo) * referenceRadius);
      falloff.push(level);
      threshold.push(bayerThreshold(gx, gy));
      x.push(gx * cell);
      y.push(gy * cell);
    }
  }
  return {
    alpha: Float32Array.from(alpha),
    depth: Float32Array.from(depth),
    edgeX: Float32Array.from(edgeX),
    edgeY: Float32Array.from(edgeY),
    falloff: Float32Array.from(falloff),
    margin,
    side,
    size: cell > 2 ? cell - 1 : cell,
    threshold: Float32Array.from(threshold),
    x: Float32Array.from(x),
    y: Float32Array.from(y),
  };
};
