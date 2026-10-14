import { isBlogPage } from "./blog/slug.ts";
import { clamp01, smoothstep } from "./math.ts";
import { type SkyMode } from "./sky-preset.ts";
import { type Spot } from "./sky-sun.ts";

export interface Screen {
  height: number;
  width: number;
}

export interface TweenPose {
  disk: number;
  source: Spot | undefined;
}

export const tweenMs = 1000;
export const leaveMs = 200;
export const arriveMs = 400;

const arriveAtMs = 600;
const arcSag = 0.25;
const minRadius = 0.5;
const holdKey = "tween";

export const easeInOut = (value: number): number => {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
};

export const routeMode = (pathname: string): SkyMode =>
  isBlogPage(pathname) ? "blog" : "home";

export const linkMode = (pathname: string): SkyMode | undefined => {
  if (pathname === "/") return "home";
  return isBlogPage(pathname) ? "blog" : undefined;
};

export const tweenProgress = (elapsed: number, forward: boolean): number => {
  const share = clamp01(elapsed / tweenMs);
  return forward ? share : 1 - share;
};

export const arriveDelay = (elapsed: number): number =>
  Math.max(0, Math.round(arriveAtMs - elapsed));

export const heldProgress = (search: string): number | undefined => {
  const raw = new URLSearchParams(search).get(holdKey);
  if (raw === null || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? clamp01(value) : undefined;
};

export const holdAt = (
  progress: number,
  held: number | undefined,
  forward: boolean
): number => {
  if (held === undefined) return progress;
  return forward ? Math.min(progress, held) : Math.max(progress, held);
};

export const arcPoint = (from: Spot, to: Spot, t: number): [number, number] => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const sag = length * arcSag;
  const normal: [number, number] =
    length > 0 ? [dy / length, -dx / length] : [0, 0];
  const side = normal[1] >= 0 ? 1 : -1;
  const control: [number, number] = [
    (from.x + to.x) / 2 + normal[0] * sag * side,
    (from.y + to.y) / 2 + normal[1] * sag * side,
  ];
  const u = 1 - t;
  return [
    u * u * from.x + 2 * u * t * control[0] + t * t * to.x,
    u * u * from.y + 2 * u * t * control[1] + t * t * to.y,
  ];
};

export const offScreen = (x: number, y: number, screen: Screen): number =>
  Math.hypot(
    Math.max(0, -x, x - screen.width),
    Math.max(0, -y, y - screen.height)
  );

const grownCorner = (corner: Spot, top: number, share: number): Spot => ({
  radius: corner.radius * share,
  x: corner.x * share,
  y: top + (corner.y - top) * share,
});

export const tweenPose = (
  progress: number,
  sun: Spot | undefined,
  corner: Spot,
  cornerTop: number,
  screen: Screen
): TweenPose => {
  const p = clamp01(progress);
  const t = easeInOut(p);
  if (sun === undefined) {
    const grown = grownCorner(corner, cornerTop, t);
    return {
      disk: 0,
      source: grown.radius >= minRadius ? grown : undefined,
    };
  }
  const [x, y] = arcPoint(sun, corner, t);
  const room = offScreen(x, y, screen);
  return {
    disk: 1 - smoothstep(0.75, 1, p),
    source: {
      radius: Math.max(sun.radius, Math.min(corner.radius, room)),
      x,
      y,
    },
  };
};
