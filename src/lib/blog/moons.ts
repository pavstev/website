export interface Orbit {
  period: number;
  rx: number;
  ry: number;
  tilt: number;
}

interface MoonPoint {
  depth: number;
  x: number;
  y: number;
}

interface Viewport {
  height: number;
  width: number;
}

const phoneWidth = 640;
const desktopReach: [number, number] = [1.9, 2.6];
const phoneReach: [number, number] = [1.55, 2.1];
const inclination = (65 * Math.PI) / 180;
const tiltSpread = (4 * Math.PI) / 180;
const basePeriod = 60;
const periodSpread = 20;
const minMoon = 10;
const maxMoon = 22;
const longRead = 60;
const edgeGap = 8;
const angleOffset = 0.35;

const share = (index: number, count: number): number =>
  count <= 1 ? 0.5 : index / (count - 1);

export const orbitFor = (
  index: number,
  count: number,
  eclipseRadius: number,
  viewport: Viewport
): Orbit => {
  const [low, high] = viewport.width < phoneWidth ? phoneReach : desktopReach;
  const t = share(index, count);
  const tilt = inclination + ((index % 3) - 1) * tiltSpread;
  const room = Math.max(
    0,
    Math.min(
      viewport.width / 2 - maxMoon - edgeGap,
      (viewport.height / 2 - maxMoon - edgeGap) / Math.cos(tilt)
    )
  );
  const rx = Math.min((low + (high - low) * t) * eclipseRadius, room);
  return {
    period: basePeriod + periodSpread * t,
    rx,
    ry: rx * Math.cos(tilt),
    tilt,
  };
};

export const moonPosition = (orbit: Orbit, angle: number): MoonPoint => {
  const sin = Math.sin(angle);
  return {
    depth: -orbit.rx * sin * Math.sin(orbit.tilt),
    x: orbit.rx * Math.cos(angle),
    y: orbit.ry * sin,
  };
};

export const moonPhase = (depth: number, x: number): number => {
  const distance = Math.hypot(depth, x);
  return distance === 0 ? 0.5 : (1 + depth / distance) / 2;
};

export const moonRadius = (minutes: number): number => {
  const clamped = Math.min(longRead, Math.max(1, minutes));
  return (
    minMoon + ((maxMoon - minMoon) * Math.log(clamped)) / Math.log(longRead)
  );
};

export const startAngle = (index: number, count: number): number =>
  angleOffset + (index * Math.PI * 2) / Math.max(1, count);

export const sharedTags = (
  a: readonly string[],
  b: readonly string[]
): string[] => a.filter((tag) => b.includes(tag));
