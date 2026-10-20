import { clamp01 } from "./math.ts";
import { hexBytes, inkPalette } from "./theme.ts";

export interface InkTarget {
  base: string;
  group?: string;
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
const skyShare = 0.98;

export const inkMargin = 1.35;
export const tintLuminance = 0.02;

export const inkTargets: readonly InkTarget[] = [
  {
    base: inkPalette.foreground,
    group: "card",
    index: 0,
    need: 4.5,
    paint: "[data-card] h1",
    probe: "[data-card] .name-letters",
  },
  {
    base: inkPalette.soft,
    group: "card",
    index: 0,
    need: 4.5,
    paint: "[data-card] .bio",
    probe: "[data-card] .bio",
  },
  {
    base: inkPalette.soft,
    index: 0,
    need: 4.5,
    paint: "[data-card] .card-footer .tabular",
    probe: "[data-card] .card-footer .tabular",
  },
];

const headerTarget = (
  selector: string,
  base: string,
  need: number
): InkTarget => ({
  base,
  index: 0,
  need,
  paint: `[data-sky-header] ${selector}`,
  probe: `[data-sky-header] ${selector}`,
});

const headerTargets = (): readonly InkTarget[] => [
  headerTarget(".blog-title", inkPalette.foreground, 3),
  headerTarget(".blog-header-meta", inkPalette.soft, 4.5),
];

export const blogIndexInkTargets: readonly InkTarget[] = headerTargets();

export const postInkTargets: readonly InkTarget[] = headerTargets();

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

export const inkGlow = (achieved: number, need: number): number => {
  const goal = need * inkMargin;
  return clamp01((goal - achieved) / (goal - 1));
};

export const nextLift = (current: number, wanted: number): number =>
  wanted > current + raiseBy || wanted < current - lowerBy ? wanted : current;

export type InkMode = "dark" | "light";

export interface InkRange {
  bright: number;
  dark: number;
}

export interface InkScores {
  dark: number;
  light: number;
}

export interface InkState {
  mode: InkMode | undefined;
  pending: InkMode | undefined;
}

export const litLift = 0.15;

export const litSky = (mode: InkMode | undefined, lift: number): boolean =>
  mode !== "dark" && lift >= litLift;

const darkShare = 0.02;
const switchMargin = 0.5;

export const freshInk: Readonly<InkState> = {
  mode: undefined,
  pending: undefined,
};

const percentile = (sorted: readonly number[], share: number): number =>
  sorted[Math.floor(share * (sorted.length - 1))] ?? 0;

export const skyRange = (pixels: Uint8Array, block: ProbeBlock): InkRange => {
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
  return {
    bright: percentile(levels, skyShare) + tintLuminance,
    dark: percentile(levels, darkShare),
  };
};

export const inkScores = (range: InkRange): InkScores => ({
  dark: contrast(liftedLuminance(inkPalette.dark, 0), range.dark),
  light: contrast(1, range.bright),
});

export const glowFor = (
  mode: InkMode,
  base: string,
  lift: number,
  range: InkRange,
  need: number
): number =>
  inkGlow(
    mode === "dark"
      ? inkScores(range).dark
      : contrast(liftedLuminance(base, lift), range.bright),
    need
  );

export interface InkPart {
  need: number;
  scores: InkScores;
}

export const sharedScores = (parts: readonly InkPart[]): InkScores => ({
  dark: Math.min(...parts.map((part) => part.scores.dark / part.need)),
  light: Math.min(...parts.map((part) => part.scores.light / part.need)),
});

export const wantedInk = (scores: InkScores, need: number): InkMode => {
  if (scores.dark >= need * inkMargin) return "dark";
  if (scores.light >= need * inkMargin) return "light";
  return scores.dark >= scores.light ? "dark" : "light";
};

const other = (mode: InkMode): InkMode => (mode === "dark" ? "light" : "dark");

const mayLeave = (from: InkMode, scores: InkScores, need: number): boolean => {
  const held = scores[from];
  const next = scores[other(from)];
  return (
    (held < need * inkMargin && next >= need * inkMargin) ||
    (held < need && next > held) ||
    next >= held + switchMargin
  );
};

export const nextInk = (
  state: InkState,
  scores: InkScores,
  need: number,
  firm = false
): InkState => {
  const wanted = wantedInk(scores, need);
  if (state.mode === undefined) return { mode: wanted, pending: undefined };
  if (wanted === state.mode || !mayLeave(state.mode, scores, need))
    return { mode: state.mode, pending: undefined };
  return firm || state.pending === wanted
    ? { mode: wanted, pending: undefined }
    : { mode: state.mode, pending: wanted };
};
