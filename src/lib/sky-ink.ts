import { hexBytes, inkPalette } from "./theme.ts";

export interface InkTarget {
  base: string;
  index: number;
  need: number;
  paint: string;
  probe: string;
}

export interface ProbeBlock {
  columns: number;
  rows: number;
  slot: number;
  stride: number;
}

const liftSteps = 20;
const raiseBy = 0.02;
const lowerBy = 0.12;
const skyShare = 0.95;

export const inkMargin = 1.08;
export const tintLuminance = 0.02;

export const inkTargets: readonly InkTarget[] = [
  {
    base: inkPalette.foreground,
    index: 0,
    need: 3,
    paint: "[data-card] h1",
    probe: "[data-card] .name-letters",
  },
  {
    base: inkPalette.soft,
    index: 0,
    need: 6.9,
    paint: "[data-card] .bio",
    probe: "[data-card] .bio",
  },
  {
    base: inkPalette.soft,
    index: 0,
    need: 4.5,
    paint: "[data-card] .repo-heading",
    probe: "[data-card] .repo-heading",
  },
  {
    base: inkPalette.soft,
    index: 1,
    need: 4.5,
    paint: "[data-card] .repo-heading",
    probe: "[data-card] .repo-heading",
  },
  {
    base: inkPalette.soft,
    index: 0,
    need: 4.5,
    paint: "[data-card] .card-footer .tabular",
    probe: "[data-card] .card-footer .tabular",
  },
  {
    base: inkPalette.muted,
    index: 0,
    need: 4.5,
    paint: "[data-card] .weather-credit",
    probe: "[data-card] .weather-credit",
  },
];

const linear = (byte: number): number => {
  const value = byte / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

export const luminance = (red: number, green: number, blue: number): number =>
  0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);

export const contrast = (first: number, second: number): number =>
  (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);

export const liftedLuminance = (base: string, lift: number): number => {
  const toward = (byte: number): number => byte + (255 - byte) * lift;
  const [red, green, blue] = hexBytes(base);
  return luminance(toward(red), toward(green), toward(blue));
};

export const liftFor = (base: string, sky: number, need: number): number => {
  for (let step = 0; step < liftSteps; step += 1) {
    const lift = step / liftSteps;
    if (contrast(liftedLuminance(base, lift), sky) >= need * inkMargin)
      return lift;
  }
  return 1;
};

export const skyLevel = (pixels: Uint8Array, block: ProbeBlock): number => {
  const levels: number[] = [];
  for (let row = 0; row < block.rows; row += 1) {
    for (let column = 0; column < block.columns; column += 1) {
      const at = (row * block.stride + block.slot * block.columns + column) * 4;
      levels.push(
        luminance(pixels[at] ?? 0, pixels[at + 1] ?? 0, pixels[at + 2] ?? 0)
      );
    }
  }
  levels.sort((first, second) => first - second);
  return (
    (levels[Math.floor(skyShare * (levels.length - 1))] ?? 0) + tintLuminance
  );
};

export const nextLift = (current: number, wanted: number): number =>
  wanted > current + raiseBy || wanted < current - lowerBy ? wanted : current;
