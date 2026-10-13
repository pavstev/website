import { clamp01, deg } from "./math.ts";
import { moonPosition, sunPosition } from "./sky-ephemeris.ts";

const stepMs = 600_000;
const spanMs = 36 * 3_600_000;
const sunHorizonDeg = 0.833;
const moonRefractionDeg = 0.5667;

export interface CardRect {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export interface PathViewport {
  focal: number;
  height: number;
  horizon: number;
  width: number;
}

export interface SkyPath {
  moon: PathPoint;
  sun: PathPoint;
}

interface Arc {
  gain: number;
  left: number;
  mode: PathMode;
  peak: number;
  right: number;
  rim: number;
}

type PathMode = "above" | "behind" | "below" | "open";

interface PathPoint {
  direction: readonly [number, number, number];
  maxAltitude: number;
  mode: PathMode;
  progress: number;
  rise: null | number;
  set: null | number;
  visible: boolean;
  x: number;
  y: number;
}

const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

const toMs = (instant: Date | number): number =>
  typeof instant === "number" ? instant : instant.getTime();

const sunHeight =
  (latitude: number, longitude: number) =>
  (ms: number): number =>
    sunPosition(ms, latitude, longitude).trueAltitude + sunHorizonDeg;

const moonHeight =
  (latitude: number, longitude: number) =>
  (ms: number): number => {
    const moon = moonPosition(ms, latitude, longitude);
    return moon.trueAltitude + moonRefractionDeg + moon.angularRadius;
  };

const edge = (
  start: number,
  direction: number,
  height: (ms: number) => number
): null | number => {
  let inside = start;
  for (
    let at = start + direction * stepMs;
    Math.abs(at - start) <= spanMs;
    at += direction * stepMs
  ) {
    if (height(at) < 0) {
      let low = inside;
      let high = at;
      for (let i = 0; i < 18; i += 1) {
        const mid = (low + high) / 2;
        if (height(mid) < 0) high = mid;
        else low = mid;
      }
      return Math.round((low + high) / 2);
    }
    inside = at;
  }
  return null;
};

const directionAt = (
  x: number,
  y: number,
  viewport: PathViewport
): readonly [number, number, number] => {
  const dx = (x - viewport.width / 2) / viewport.height;
  const dy = (viewport.height - y) / viewport.height - viewport.horizon;
  const length = Math.hypot(dx, dy, viewport.focal);
  return [dx / length, dy / length, viewport.focal / length];
};

export const arcLayout = (
  viewport: PathViewport,
  lift: number,
  card?: CardRect
): Arc => {
  const { height, horizon, width } = viewport;
  const rim = height * (1 - horizon);
  const side = Math.max(24, width * 0.07);
  const right = width - side;
  const left = side;
  const top = Math.max(12, height * 0.03) + 8;
  const natural = rim - (rim - top) * mix(0.72, 0.95, lift);
  if (card === undefined)
    return { gain: 1, left, mode: "open", peak: natural, right, rim };
  const margin = Math.max(16, height * 0.02);
  const limit = card.top - margin;
  if (limit - top >= height * 0.04) {
    const peak = limit - (limit - top) * mix(0.3, 1, lift);
    const near = (right - card.right) / (right - left);
    const far = (right - card.left) / (right - left);
    const need = (rim - limit) / (rim - peak);
    if (near > 0 && far < 1 && need < 1) {
      const low = Math.min(Math.sin(Math.PI * near), Math.sin(Math.PI * far));
      return {
        gain: Math.max(1, need / Math.max(low, 0.01)),
        left,
        mode: "above",
        peak,
        right,
        rim,
      };
    }
  }
  const band = rim - (card.bottom + margin);
  if (band >= height * 0.08) {
    return {
      gain: 1,
      left,
      mode: "below",
      peak: rim - band * mix(0.55, 1, lift),
      right,
      rim,
    };
  }
  return { gain: 1, left, mode: "behind", peak: natural, right, rim };
};

const bodyPath = (
  ms: number,
  height: (at: number) => number,
  altitude: (at: number) => number,
  viewport: PathViewport,
  card?: CardRect
): PathPoint => {
  const up = height(ms) >= 0;
  const rise = up ? edge(ms, -1, height) : null;
  const set = up ? edge(ms, 1, height) : null;
  const start = rise ?? ms - spanMs;
  const end = set ?? ms + spanMs;
  let maxAltitude = altitude(ms);
  for (let i = 1; i < 16; i += 1)
    maxAltitude = Math.max(
      maxAltitude,
      altitude(start + ((end - start) * i) / 16)
    );
  const lift = clamp01((maxAltitude - 10) / 55);
  const arc = arcLayout(viewport, lift, card);
  const progress = up ? clamp01((ms - start) / (end - start)) : 0;
  const x = arc.right - progress * (arc.right - arc.left);
  const rise01 = Math.min(1, Math.sin(Math.PI * progress) * arc.gain);
  const y = arc.rim - (arc.rim - arc.peak) * (1 - (1 - rise01) ** 2);
  return {
    direction: directionAt(x, y, viewport),
    maxAltitude,
    mode: arc.mode,
    progress,
    rise,
    set,
    visible: up,
    x,
    y,
  };
};

export const skyPath = (
  instant: Date | number,
  latitude: number,
  longitude: number,
  viewport: PathViewport,
  card?: CardRect
): SkyPath => {
  const ms = toMs(instant);
  return {
    moon: bodyPath(
      ms,
      moonHeight(latitude, longitude),
      (at) => moonPosition(at, latitude, longitude).altitude,
      viewport,
      card
    ),
    sun: bodyPath(
      ms,
      sunHeight(latitude, longitude),
      (at) => sunPosition(at, latitude, longitude).altitude,
      viewport,
      card
    ),
  };
};

export const viewportFocal = (verticalFovDeg: number): number =>
  0.5 / Math.tan((verticalFovDeg * deg) / 2);
