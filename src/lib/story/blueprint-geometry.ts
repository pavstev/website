import { clamp01, smoothstep } from "../math.ts";
import { storyPalette } from "../theme.ts";
import {
  gaugeSpot,
  loopPhases,
  type SkillMap,
  skillSpots,
  stopAt,
  walkOf,
} from "./skill-map.ts";
import { type StepId } from "./step-ids.ts";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const toneNames = [
  "ink",
  "line",
  "muted",
  "accent",
  "mark",
  "markAlt",
  "denied",
  "white",
] as const;

export interface Scene {
  focus: number;
  gridPoints: number;
  half: number;
  labels: Label[];
  lineColors: Float32Array;
  lines: Float32Array;
  plate: undefined | Vec3;
  points: Float32Array;
  slabSegments: number;
  span: number;
  triColors: Float32Array;
  tris: Float32Array;
}

export interface SceneCounts {
  agents: number;
  guardChecks: number;
  homeFiles: number;
  hookEvents: number;
  outputStyles: number;
  presets: number;
  rustPrograms: number;
  skills: number;
}

interface Label {
  alpha: number;
  at: Vec3;
  center: boolean;
  id: string;
  text: string;
  tone: ToneName;
}

type ToneName = (typeof toneNames)[number];

export const strides = {
  line: 6,
  lineColor: 2,
  point: 6,
  tri: 9,
  triColor: 2,
} as const;

const tone = {
  accent: 3,
  denied: 6,
  ink: 0,
  line: 1,
  mark: 4,
  markAlt: 5,
  muted: 2,
  white: 7,
} as const satisfies Record<ToneName, number>;

const isoYaw = -0.72;
const isoPitch = 0.615;
const depth = 20;

export const orbitPitch = { max: 1.45 - isoPitch, min: 0.12 - isoPitch };
const slab = { hx: 1.3, hy: 0.09, hz: 0.85 } as const;
const slabNames = ["docs/", "scripts/", "claude/", "home/", "rust/"] as const;
const slabOrder = [2, 4, 3, 1, 0] as const;
const floorY = -2.6;
const sheet = { hx: 2.45, hz: 1.75 } as const;
const titleBlock = { hx: 0.9, hz: 0.3, x: 1.55, z: 1.45 } as const;
const tileSlots = 25;
const hatched: ReadonlySet<number> = new Set([3, 8, 12, 17]);
const edges = [
  [0, 1],
  [2, 3],
  [4, 5],
  [6, 7],
  [0, 2],
  [1, 3],
  [4, 6],
  [5, 7],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
] as const;
export const phoneLabelLimit = 4;
const pathNodes = 7;
const guardNode = 2;
const pathX0 = -2.05;
const pathX1 = 2.05;
const labelFloor = 0.2;
const tallLift = 0.3;

const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

interface Floats {
  data: Float32Array;
  length: number;
}

const floats = (capacity: number): Floats => ({
  data: new Float32Array(capacity),
  length: 0,
});

const reserve = (buffer: Floats, extra: number): void => {
  const need = buffer.length + extra;
  if (need <= buffer.data.length) return;
  const next = new Float32Array(Math.max(need, buffer.data.length * 2));
  next.set(buffer.data.subarray(0, buffer.length));
  buffer.data = next;
};

const lineBuf = floats(4096);
const lineColorBuf = floats(1400);
const triBuf = floats(256);
const triColorBuf = floats(64);
const pointBuf = floats(1024);

const seg = (
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  toneIndex: number,
  alpha: number
): void => {
  if (alpha <= 0.004 || (ax === bx && ay === by && az === bz)) return;
  reserve(lineBuf, 6);
  reserve(lineColorBuf, 2);
  const d = lineBuf.data;
  const n = lineBuf.length;
  d[n] = ax;
  d[n + 1] = ay;
  d[n + 2] = az;
  d[n + 3] = bx;
  d[n + 4] = by;
  d[n + 5] = bz;
  lineBuf.length = n + 6;
  lineColorBuf.data[lineColorBuf.length] = toneIndex;
  lineColorBuf.data[lineColorBuf.length + 1] = alpha;
  lineColorBuf.length += 2;
};

const dash = (
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  count: number,
  toneIndex: number,
  alpha: number
): void => {
  for (let i = 0; i < count; i += 1) {
    const u = i / count;
    const v = (i + 0.55) / count;
    seg(
      lerp(ax, bx, u),
      lerp(ay, by, u),
      lerp(az, bz, u),
      lerp(ax, bx, v),
      lerp(ay, by, v),
      lerp(az, bz, v),
      toneIndex,
      alpha
    );
  }
};

const box = (
  cx: number,
  cy: number,
  cz: number,
  hx: number,
  hy: number,
  hz: number,
  toneIndex: number,
  alpha: number,
  dashCount = 0
): void => {
  for (const [a, b] of edges) {
    const ax = cx + (a & 1 ? hx : -hx);
    const ay = cy + (a & 2 ? hy : -hy);
    const az = cz + (a & 4 ? hz : -hz);
    const bx = cx + (b & 1 ? hx : -hx);
    const by = cy + (b & 2 ? hy : -hy);
    const bz = cz + (b & 4 ? hz : -hz);
    if (dashCount > 0)
      dash(ax, ay, az, bx, by, bz, dashCount, toneIndex, alpha);
    else seg(ax, ay, az, bx, by, bz, toneIndex, alpha);
  }
};

const rectY = (
  y: number,
  cx: number,
  cz: number,
  hx: number,
  hz: number,
  toneIndex: number,
  alpha: number,
  dashCount = 0
): void => {
  const xs = [cx - hx, cx + hx, cx + hx, cx - hx] as const;
  const zs = [cz - hz, cz - hz, cz + hz, cz + hz] as const;
  for (let k = 0; k < 4; k += 1) {
    const n = (k + 1) % 4;
    if (dashCount > 0) {
      dash(
        xs[k] ?? 0,
        y,
        zs[k] ?? 0,
        xs[n] ?? 0,
        y,
        zs[n] ?? 0,
        dashCount,
        toneIndex,
        alpha
      );
    } else {
      seg(
        xs[k] ?? 0,
        y,
        zs[k] ?? 0,
        xs[n] ?? 0,
        y,
        zs[n] ?? 0,
        toneIndex,
        alpha
      );
    }
  }
};

const triangle = (
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
  toneIndex: number,
  alpha: number
): void => {
  reserve(triBuf, 9);
  reserve(triColorBuf, 2);
  const d = triBuf.data;
  const n = triBuf.length;
  d[n] = ax;
  d[n + 1] = ay;
  d[n + 2] = az;
  d[n + 3] = bx;
  d[n + 4] = by;
  d[n + 5] = bz;
  d[n + 6] = cx;
  d[n + 7] = cy;
  d[n + 8] = cz;
  triBuf.length = n + 9;
  triColorBuf.data[triColorBuf.length] = toneIndex;
  triColorBuf.data[triColorBuf.length + 1] = alpha;
  triColorBuf.length += 2;
};

const faceY = (
  y: number,
  hx: number,
  hz: number,
  toneIndex: number,
  alpha: number,
  cx = 0,
  cz = 0
): void => {
  const x0 = cx - hx;
  const x1 = cx + hx;
  const z0 = cz - hz;
  const z1 = cz + hz;
  triangle(x0, y, z0, x1, y, z0, x1, y, z1, toneIndex, alpha);
  triangle(x0, y, z0, x1, y, z1, x0, y, z1, toneIndex, alpha);
};

const point = (
  x: number,
  y: number,
  z: number,
  toneIndex: number,
  alpha: number,
  size: number
): void => {
  reserve(pointBuf, 6);
  const d = pointBuf.data;
  const n = pointBuf.length;
  d[n] = x;
  d[n + 1] = y;
  d[n + 2] = z;
  d[n + 3] = toneIndex;
  d[n + 4] = alpha;
  d[n + 5] = size;
  pointBuf.length = n + 6;
};

const reach = { x: 0.55, y: 0.3, z: 0.45 } as const;

const leader = (y: number, toneIndex: number, alpha: number): Vec3 => {
  const end = {
    x: slab.hx + reach.x,
    y: y + reach.y,
    z: slab.hz + reach.z,
  };
  seg(slab.hx, y, slab.hz, end.x, end.y, end.z, toneIndex, alpha);
  return end;
};

interface Beat {
  claudeTone: number;
  copies: number;
  fan: number;
  ghost: number;
  hatch: number;
  labels: number;
  ledgerAlpha: number;
  ledgerProgress: number;
  links: number;
  lock: number;
  mapAlpha: number;
  outside: number;
  pathAlpha: number;
  pathProgress: number;
  replayAlpha: number;
  replayOffset: number;
  rosterAlpha: number;
  rosterProgress: number;
  sheetTwo: boolean;
  slabAlpha: number[];
  slabDrop: number[];
  spread: number;
  tileReveal: number;
  tilesAlpha: number;
  walk: number;
  zoom: number;
}

const beat: Beat = {
  claudeTone: tone.line,
  copies: 0,
  fan: 0,
  ghost: 0,
  hatch: 0,
  labels: 1,
  ledgerAlpha: 0,
  ledgerProgress: 0,
  links: 0,
  lock: 0,
  mapAlpha: 0,
  outside: 0,
  pathAlpha: 0,
  pathProgress: 0,
  replayAlpha: 0,
  replayOffset: 0,
  rosterAlpha: 0,
  rosterProgress: 0,
  sheetTwo: false,
  slabAlpha: [1, 1, 1, 1, 1],
  slabDrop: [0, 0, 0, 0, 0],
  spread: 0.35,
  tileReveal: 1,
  tilesAlpha: 0.9,
  walk: 0,
  zoom: 0,
};

const resetBeat = (): void => {
  beat.claudeTone = tone.line;
  beat.copies = 0;
  beat.fan = 0;
  beat.ghost = 0;
  beat.hatch = 0;
  beat.labels = 1;
  beat.ledgerAlpha = 0;
  beat.ledgerProgress = 0;
  beat.links = 0;
  beat.lock = 0;
  beat.mapAlpha = 0;
  beat.outside = 0;
  beat.pathAlpha = 0;
  beat.pathProgress = 0;
  beat.replayAlpha = 0;
  beat.replayOffset = 0;
  beat.rosterAlpha = 0;
  beat.rosterProgress = 0;
  beat.sheetTwo = false;
  beat.slabAlpha.fill(1);
  beat.slabDrop.fill(0);
  beat.spread = 0.35;
  beat.tileReveal = 1;
  beat.tilesAlpha = 0.9;
  beat.walk = 0;
  beat.zoom = 0;
};

const walkFade = 0.03;

const bump = (t: number): number =>
  smoothstep(0, 0.12, t) * (1 - smoothstep(0.12, 0.38, t));

const harnessBase = (): void => {
  beat.slabAlpha.fill(0.1);
  beat.spread = 0.2;
  beat.labels = 0;
  beat.tilesAlpha = 0;
  beat.sheetTwo = true;
  beat.zoom = 1;
};

const applyBeat = (step: StepId, t: number): void => {
  resetBeat();
  switch (step) {
    case "c01": {
      const k = smoothstep(0, 0.2, t);
      beat.spread = 0.35 * k;
      for (const i of [0, 1, 2, 4]) beat.slabAlpha[i] = 1 - 0.88 * k;
      beat.tileReveal = clamp01(t * 1.5);
      beat.ghost = smoothstep(0.35, 0.55, t);
      beat.links = smoothstep(0.45, 1, t);
      break;
    }
    case "c02": {
      const sink = smoothstep(0, 0.15, t);
      beat.ghost = 1 - smoothstep(0, 0.25, t);
      beat.links = beat.ghost;
      for (const [k, i] of [4, 2, 1, 0].entries()) {
        const rise = smoothstep(0.2 + k * 0.16, 0.42 + k * 0.16, t);
        beat.slabAlpha[i] = Math.max(rise, 0.12 * (1 - sink));
        beat.slabDrop[i] = -3.2 * (1 - rise) * sink;
      }
      break;
    }
    case "c03": {
      beat.spread = 0.35 + 0.45 * bump(t);
      beat.replayOffset = 2.6 * (1 - smoothstep(0, 0.5, t));
      beat.replayAlpha =
        0.85 * smoothstep(0, 0.1, t) * (1 - smoothstep(0.55, 0.75, t));
      break;
    }
    case "c04": {
      beat.spread = 0.35 + 0.45 * bump(t);
      beat.copies = smoothstep(0.05, 0.35, t) * (1 - smoothstep(0.7, 0.95, t));
      break;
    }
    case "c05": {
      beat.spread = 0.35 + 0.45 * bump(t);
      beat.hatch = smoothstep(0.1, 0.4, t);
      beat.lock = smoothstep(0.3, 0.6, t);
      beat.outside = smoothstep(0.55, 0.85, t);
      break;
    }
    case "c06": {
      const carry = 1 - smoothstep(0, 0.15, t);
      beat.spread = 0.35 + 0.45 * bump(t);
      beat.hatch = carry;
      beat.lock = carry;
      beat.outside = carry;
      beat.fan = smoothstep(0.1, 0.5, t);
      beat.claudeTone = t > 0.1 ? tone.mark : tone.line;
      break;
    }
    case "h1": {
      harnessBase();
      beat.pathAlpha = 1;
      beat.pathProgress = t;
      break;
    }
    case "h2": {
      harnessBase();
      beat.pathAlpha = 1 - smoothstep(0, 0.12, t);
      beat.pathProgress = 1;
      beat.ledgerAlpha = 1;
      beat.ledgerProgress = t;
      break;
    }
    case "h3": {
      harnessBase();
      beat.ledgerAlpha = 1 - smoothstep(0, 0.12, t);
      beat.ledgerProgress = 1;
      beat.rosterAlpha = 1;
      beat.rosterProgress = t;
      break;
    }
    case "harness": {
      const fade = smoothstep(0.1, 0.6, t);
      beat.fan = 1 - smoothstep(0, 0.25, t);
      beat.claudeTone = beat.fan > 0.05 ? tone.mark : tone.line;
      beat.slabAlpha.fill(1 - 0.9 * fade);
      beat.spread = 0.35 - 0.15 * smoothstep(0, 0.5, t);
      beat.labels = 1 - fade;
      beat.tilesAlpha = 0.9 * (1 - fade);
      beat.sheetTwo = t >= 0.5;
      beat.zoom = fade;
      break;
    }
    case "hero": {
      beat.spread = 1 - smoothstep(0.4, 1, t);
      beat.tilesAlpha = 0;
      break;
    }
    case "outro": {
      const show = smoothstep(0.3, 0.8, t);
      beat.spread = 0.2 + 0.8 * smoothstep(0, 0.35, t);
      beat.slabAlpha.fill(0.1 + 0.9 * smoothstep(0.1, 0.5, t));
      beat.labels = show;
      beat.tilesAlpha = 0.9 * show;
      beat.mapAlpha = 1 - smoothstep(0, 0.2, t);
      beat.walk = 1;
      beat.sheetTwo = t < 0.3;
      beat.zoom = 1 - smoothstep(0, 0.35, t);
      break;
    }
    case "skills": {
      harnessBase();
      beat.slabAlpha.fill(0.04);
      beat.rosterAlpha = 1 - smoothstep(0, walkFade, t);
      beat.rosterProgress = 1;
      beat.mapAlpha = smoothstep(0, walkFade, t);
      beat.walk = t;
      break;
    }
  }
};

const pathNames = [
  "prompt",
  "hook",
  "guard",
  "router",
  "pace",
  "the call",
  "post hooks",
] as const;

const guardStop = guardNode / (pathNodes - 1);

const packetPosition = (a: number): number => {
  if (a < 0.5) return -1;
  if (a < 0.64) return guardStop * smoothstep(0.5, 0.64, a);
  if (a < 0.76) return guardStop;
  return a < 0.82
    ? guardStop * (1 - smoothstep(0.76, 0.82, a))
    : smoothstep(0.82, 1, a);
};

const packetState = (a: number): "denied" | "normal" | "passed" => {
  if (a >= 0.64 && a < 0.76) return "denied";
  return a >= 0.82 && smoothstep(0.82, 1, a) > guardStop + 0.02
    ? "passed"
    : "normal";
};

const ledgerTexts: readonly string[] = [
  "presets  off costs no tokens",
  "sh  not bash, less time per call",
  "router  opus plans, haiku looks, sonnet builds",
  "G8 G7  few helpers, fewer when ahead",
  "status  copper, then hand off to a file",
];

const rosterRows = (
  counts: SceneCounts
): ReadonlyArray<readonly [string, number, number, number]> => [
  ["skills · askme, pick, mic-drop", counts.skills, 0.07, tone.line],
  ["agents · worker, code-reviewer", counts.agents, 0.16, tone.accent],
  ["presets · clock, pace, models", counts.presets, 0.14, tone.mark],
  ["hooks · before and after each call", counts.hookEvents, 0.12, tone.line],
  ["rust · guard, dots, ctx", counts.rustPrograms, 0.07, tone.line],
  ["styles · plain and simple", counts.outputStyles, 0.16, tone.line],
];

type Lab = (
  id: string,
  text: string,
  x: number,
  y: number,
  z: number,
  toneName: ToneName,
  alpha: number,
  center?: boolean
) => void;

const skillFoot = { hx: 0.2, hz: 0.14 } as const;
const skillLift = 0.18;
const gaugeRadius = 0.24;
const gaugeSteps = 28;
const curveSteps = 14;
const strandGap = 0.014;
const chainStrands = 3;

const arcFloor = (
  cx: number,
  y: number,
  cz: number,
  sweep: number,
  toneIndex: number,
  alpha: number,
  dashed: boolean
): void => {
  const steps = Math.ceil(gaugeSteps * sweep);
  for (let k = 0; k < steps; k += 1) {
    if (dashed && k % 2 === 1) continue;
    const a = -Math.PI / 2 + (2 * Math.PI * k) / gaugeSteps;
    const b =
      -Math.PI / 2 + 2 * Math.PI * Math.min(sweep, (k + 1) / gaugeSteps);
    seg(
      cx + Math.cos(a) * gaugeRadius,
      y,
      cz + Math.sin(a) * gaugeRadius,
      cx + Math.cos(b) * gaugeRadius,
      y,
      cz + Math.sin(b) * gaugeRadius,
      toneIndex,
      alpha
    );
  }
};

const skillHeight = (links: number): number => 0.08 + 0.07 * links;

const bridge = (
  from: Vec3,
  to: Vec3,
  reveal: number,
  strands: number,
  alpha: number
): void => {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz) || 1;
  const nx = -dz / length;
  const nz = dx / length;
  const rise = 0.3 + 0.12 * length;
  const steps = Math.ceil(curveSteps * reveal);
  for (let strand = 0; strand < strands; strand += 1) {
    const off = (strand - (strands - 1) / 2) * strandGap;
    for (let k = 0; k < steps; k += 1) {
      const a = k / curveSteps;
      const b = Math.min(reveal, (k + 1) / curveSteps);
      seg(
        lerp(from.x, to.x, a) + nx * off,
        lerp(from.y, to.y, a) + 4 * a * (1 - a) * rise,
        lerp(from.z, to.z, a) + nz * off,
        lerp(from.x, to.x, b) + nx * off,
        lerp(from.y, to.y, b) + 4 * b * (1 - b) * rise,
        lerp(from.z, to.z, b) + nz * off,
        tone.markAlt,
        alpha
      );
    }
  }
};

const drawSkills = (
  map: SkillMap,
  scroll: number,
  alpha: number,
  sy: number,
  lab: Lab
): undefined | Vec3 => {
  const count = map.stops.length;
  if (count === 0) return undefined;
  const walk = walkOf(scroll, count);
  const { stop, u } = stopAt(walk, count);
  const arrive = smoothstep(0, 0.35, u);
  const reached = (k: number): number => {
    if (k < stop) return 1;
    return k === stop ? arrive : 0;
  };
  const spots = skillSpots(map.stops);
  const floor = sy + 0.002;
  const at = (k: number): Vec3 => ({
    x: spots[k]?.x ?? 0,
    y: floor,
    z: spots[k]?.z ?? 0,
  });

  for (let k = 1; k < count; k += 1) {
    const r = reached(k);
    if (r <= 0) continue;
    const a = at(k - 1);
    const b = at(k);
    seg(
      a.x,
      floor,
      a.z,
      lerp(a.x, b.x, r),
      floor,
      lerp(a.z, b.z, r),
      tone.accent,
      0.75 * alpha
    );
  }

  const head = at(stop);
  const tail = at(Math.max(0, stop - 1));
  const hx = stop === 0 ? head.x : lerp(tail.x, head.x, arrive);
  const hz = stop === 0 ? head.z : lerp(tail.z, head.z, arrive);
  if (walk < 1) {
    point(hx, floor + 0.05, hz, tone.ink, alpha, 6);
    point(hx, floor + 0.05, hz, tone.accent, 0.35 * alpha, 22);
  }

  let anchor: undefined | Vec3;
  const current = map.stops[stop];
  for (const [k, item] of map.stops.entries()) {
    const spot = at(k);
    const seen = k <= stop || walk >= 1;
    const lit = k === stop && walk < 1 ? arrive : 0;
    const lift = skillLift * lit;
    const base = sy + lift;
    const shown = (seen ? 0.85 : 0.35) * alpha;
    const toneIndex = lit > 0.5 ? tone.accent : seen ? tone.line : tone.muted;
    if (item.known) {
      const hy = skillHeight(item.links) / 2;
      box(
        spot.x,
        base + hy,
        spot.z,
        skillFoot.hx,
        hy,
        skillFoot.hz,
        toneIndex,
        shown
      );
      faceY(
        base + 2 * hy,
        skillFoot.hx,
        skillFoot.hz,
        tone.white,
        storyPalette.face * (seen ? 1 : 0.4) * alpha,
        spot.x,
        spot.z
      );
    } else {
      rectY(
        base + 0.004,
        spot.x,
        spot.z,
        skillFoot.hx,
        skillFoot.hz,
        toneIndex,
        shown,
        6
      );
    }
    if (k !== stop) continue;
    const top = base + (item.known ? skillHeight(item.links) : 0.004);
    anchor = { x: spot.x - skillFoot.hx, y: top, z: spot.z - skillFoot.hz };
  }

  if (current && walk < 1) {
    const spot = at(stop);
    const top =
      sy +
      skillLift * arrive +
      (current.known ? skillHeight(current.links) : 0);
    lab(
      `skill-${String(stop)}`,
      current.skill.replace("ps:", ""),
      spot.x,
      top + 0.22,
      spot.z,
      "accent",
      alpha * arrive,
      true
    );
  }

  const phaseOrder = loopPhases
    .map((phase, j) => ({ j, phase }))
    .toSorted(
      (a, b) =>
        Number(b.phase === current?.phase) - Number(a.phase === current?.phase)
    );
  for (const { j, phase } of phaseOrder) {
    const first = map.stops.findIndex((item) => item.phase === phase);
    if (first === -1) continue;
    const reveal =
      walk >= 1 || first < stop
        ? 1
        : first === stop
          ? smoothstep(0.1, 0.6, u)
          : 0;
    const centre = gaugeSpot(phase);
    const share = map.phases[j] ?? 0;
    arcFloor(
      centre.x,
      floor,
      centre.z,
      1,
      tone.white,
      storyPalette.hairStrong * 2 * alpha,
      true
    );
    if (reveal > 0)
      arcFloor(
        centre.x,
        floor,
        centre.z,
        share * reveal,
        tone.mark,
        0.9 * alpha,
        false
      );
    const near = current?.phase === phase && walk < 1;
    lab(
      `phase-${phase}`,
      phase,
      centre.x,
      floor,
      centre.z + (phase === "care" ? -0.36 : -0.34),
      near ? "mark" : "muted",
      alpha * (near ? 1 : 0.85 * Math.max(0.35, reveal)),
      true
    );
  }

  for (const chain of map.chains) {
    const later = Math.max(chain.from, chain.to);
    const reveal =
      walk >= 1 || later < stop
        ? 1
        : later === stop
          ? smoothstep(0.2, 0.8, u)
          : 0;
    if (reveal <= 0) continue;
    bridge(at(chain.from), at(chain.to), reveal, chainStrands, 0.5 * alpha);
  }

  return anchor;
};

export const buildScene = (
  step: StepId,
  t: number,
  explode: number,
  counts: SceneCounts,
  labelLimit = Infinity,
  map?: SkillMap
): Scene => {
  const local = clamp01(t);
  applyBeat(step, local);
  lineBuf.length = 0;
  lineColorBuf.length = 0;
  triBuf.length = 0;
  triColorBuf.length = 0;
  pointBuf.length = 0;

  const labels: Label[] = [];
  const room = (alpha: number): boolean =>
    alpha >= labelFloor && labels.length < labelLimit;
  const lab: Lab = (id, text, x, y, z, toneName, alpha, center = false) => {
    if (!room(alpha)) return;
    labels.push({
      alpha,
      at: { x, y, z },
      center,
      id,
      text,
      tone: toneName,
    });
  };

  const spread = clamp01(explode) * clamp01(beat.spread);
  const gap = 0.26 + 0.9 * spread;
  const ys = [0, 1, 2, 3, 4].map(
    (i) => floorY + 0.4 + (4 - i) * gap + (beat.slabDrop[i] ?? 0)
  );
  const slabTone = (i: number): number =>
    i === 4 ? tone.accent : i === 2 ? beat.claudeTone : tone.line;

  for (let x = -sheet.hx + 0.15; x <= sheet.hx - 0.1; x += 0.5) {
    for (let z = -sheet.hz + 0.15; z <= sheet.hz - 0.1; z += 0.5) {
      point(x, floorY, z, tone.white, storyPalette.grid, 2);
    }
  }
  const gridPoints = pointBuf.length / strides.point;

  let slabSegments = 0;
  for (let i = 0; i < 5; i += 1) {
    const a = beat.slabAlpha[i] ?? 0;
    if (a <= 0.01) continue;
    const y = ys[i] ?? 0;
    box(0, y, 0, slab.hx, slab.hy, slab.hz, slabTone(i), 0.85 * a);
    faceY(y + slab.hy, slab.hx, slab.hz, tone.white, storyPalette.face * a);
    slabSegments += edges.length;
  }

  rectY(
    floorY,
    0,
    0,
    sheet.hx,
    sheet.hz,
    tone.white,
    storyPalette.hairStrong,
    40
  );
  faceY(
    floorY,
    titleBlock.hx,
    titleBlock.hz,
    tone.white,
    storyPalette.face * 0.5,
    titleBlock.x,
    titleBlock.z
  );
  rectY(
    floorY,
    titleBlock.x,
    titleBlock.z,
    titleBlock.hx,
    titleBlock.hz,
    tone.white,
    storyPalette.hairStrong
  );

  for (const i of slabOrder) {
    const a = beat.slabAlpha[i] ?? 0;
    const lo = beat.labels * a;
    if (a <= 0.01 || !room(lo)) continue;
    const y = (ys[i] ?? 0) + slab.hy;
    const end = leader(y, slabTone(i), 0.7 * a);
    lab(
      `slab-${String(i)}`,
      slabNames[i] ?? "",
      end.x,
      end.y,
      end.z,
      i === 4 ? "accent" : "ink",
      lo
    );
  }

  const homeY = (ys[3] ?? 0) + slab.hy + 0.003;
  const tileCount = Math.min(tileSlots, counts.homeFiles);
  const tilesShown = beat.tileReveal * tileCount;
  const tileAlpha = beat.tilesAlpha * (beat.slabAlpha[3] ?? 0);
  const ghostY = (ys[3] ?? 0) + 1.5;
  for (let k = 0; k < tileCount; k += 1) {
    const reveal = clamp01(tilesShown - k);
    const a = tileAlpha * reveal;
    if (a <= 0.01) continue;
    const x = ((k % 5) - 2) * 0.5;
    const z = (Math.floor(k / 5) - 2) * 0.3;
    rectY(homeY, x, z, 0.17, 0.1, tone.accent, 0.8 * a);
    if (beat.hatch > 0 && hatched.has(k)) {
      for (let h = 0; h < 4; h += 1) {
        const u = x - 0.17 + ((h + 0.5) / 4) * 0.34;
        seg(
          u,
          homeY,
          z - 0.1,
          u - 0.12,
          homeY,
          z + 0.1,
          tone.denied,
          0.85 * a * beat.hatch
        );
      }
    }
    const lr = clamp01(beat.links * 1.3 - k / tileCount);
    if (lr > 0) {
      dash(
        x,
        homeY,
        z,
        x,
        lerp(homeY, ghostY - slab.hy, lr),
        z,
        10,
        tone.accent,
        0.55
      );
    }
  }

  if (beat.ghost > 0) {
    box(
      0,
      ghostY,
      0,
      slab.hx,
      slab.hy,
      slab.hz,
      tone.accent,
      0.5 * beat.ghost,
      8
    );
    if (room(beat.ghost)) {
      const end = leader(ghostY + slab.hy, tone.accent, 0.5 * beat.ghost);
      lab("ghost", "$HOME", end.x, end.y, end.z, "accent", beat.ghost);
    }
  }

  if (beat.outside > 0) {
    const ox = sheet.hx + 0.6;
    const oz = -1;
    rectY(floorY + 0.003, ox, oz, 0.17, 0.1, tone.mark, 0.9 * beat.outside);
    lab(
      "owner",
      "owner.md  outside git",
      ox,
      floorY,
      oz + 0.45,
      "mark",
      beat.outside,
      true
    );
  }

  if (beat.lock > 0) {
    const cy = (ys[0] ?? 0) + 1.1;
    const a = 0.9;
    const arc = 10;
    const total = 4 + arc;
    const shown = Math.ceil(beat.lock * total);
    const body = [
      [-0.22, cy - 0.18, 0.22, cy - 0.18],
      [0.22, cy - 0.18, 0.22, cy + 0.14],
      [0.22, cy + 0.14, -0.22, cy + 0.14],
      [-0.22, cy + 0.14, -0.22, cy - 0.18],
    ] as const;
    for (const [k, [ax, ay, bx, by]] of body.entries()) {
      if (k < shown) seg(ax, ay, 0, bx, by, 0, tone.accent, a);
    }
    for (let k = 0; k < arc; k += 1) {
      if (k + 4 >= shown) break;
      const p = (Math.PI * k) / arc;
      const q = (Math.PI * (k + 1)) / arc;
      seg(
        Math.cos(p) * 0.15,
        cy + 0.14 + Math.sin(p) * 0.2,
        0,
        Math.cos(q) * 0.15,
        cy + 0.14 + Math.sin(q) * 0.2,
        0,
        tone.accent,
        a
      );
    }
    lab("lock", "no secrets, no names", 0.35, cy, 0, "accent", beat.lock);
  }

  if (beat.replayAlpha > 0) {
    for (let i = 0; i < 5; i += 1) {
      box(
        0,
        (ys[i] ?? 0) + beat.replayOffset,
        0,
        slab.hx,
        slab.hy,
        slab.hz,
        tone.markAlt,
        0.6 * beat.replayAlpha
      );
    }
  }

  if (beat.copies > 0) {
    const off = 2.75 * beat.copies;
    const names = ["macOS", "Windows"] as const;
    for (const [k, ox] of [-off, off].entries()) {
      for (let i = 0; i < 5; i += 1) {
        box(
          ox,
          ys[i] ?? 0,
          0,
          slab.hx,
          slab.hy,
          slab.hz,
          tone.line,
          0.45 * beat.copies
        );
      }
      lab(
        `copy-${String(k)}`,
        names[k] ?? "",
        ox,
        (ys[0] ?? 0) + 0.75,
        0,
        "ink",
        beat.copies,
        true
      );
    }
    lab(
      "copy-linux",
      "Linux · fresh containers",
      0,
      (ys[0] ?? 0) + 0.75,
      0,
      "ink",
      beat.copies,
      true
    );
  }

  if (beat.fan > 0) {
    const dz = 1.9 * beat.fan;
    const marks = ["Cursor", "Opencode"] as const;
    for (const [k, oz] of [-dz, dz].entries()) {
      box(
        0,
        ys[2] ?? 0,
        oz,
        slab.hx,
        slab.hy,
        slab.hz,
        tone.mark,
        0.7 * beat.fan
      );
      lab(
        `fan-${String(k)}`,
        `${marks[k] ?? ""} · generated-by: dotfiles`,
        0,
        (ys[2] ?? 0) + (oz < 0 ? 0.8 : -0.9),
        oz + (oz < 0 ? -1 : 1) * (slab.hz + 0.5),
        "mark",
        beat.fan,
        true
      );
    }
  }

  const sy = floorY + 0.004;

  if (beat.pathAlpha > 0) {
    const a = beat.pathProgress;
    const fade = beat.pathAlpha;
    const nodeX = (i: number): number =>
      lerp(pathX0, pathX1, i / (pathNodes - 1));
    const pos = packetPosition(a);
    const state = packetState(a);
    const denyAlpha =
      smoothstep(0.64, 0.68, a) * (1 - smoothstep(0.74, 0.78, a)) * fade;
    const passAlpha = smoothstep(0.88, 0.94, a) * fade;
    lab(
      "deny",
      "G14 denied",
      nodeX(guardNode),
      sy,
      -0.85,
      "denied",
      denyAlpha,
      true
    );
    lab(
      "pass",
      "allowed",
      nodeX(guardNode),
      sy,
      -0.85,
      "markAlt",
      passAlpha,
      true
    );
    const reveals: number[] = [];
    for (let i = 0; i < pathNodes; i += 1) {
      const r =
        smoothstep((i / pathNodes) * 0.4, (i / pathNodes) * 0.4 + 0.12, a) *
        fade;
      reveals.push(r);
      if (r <= 0) continue;
      const x = nodeX(i);
      const guardTone =
        state === "denied"
          ? tone.denied
          : state === "passed"
            ? tone.markAlt
            : tone.accent;
      const nodeTone =
        i === guardNode ? guardTone : i === 5 ? tone.markAlt : tone.line;
      rectY(sy, x, 0, 0.2, 0.16, nodeTone, 0.9 * r);
      if (i < pathNodes - 1) {
        seg(
          x + 0.2,
          sy,
          0,
          nodeX(i + 1) - 0.2,
          sy,
          0,
          tone.white,
          storyPalette.hairStrong * 3 * r
        );
      }
      lab(
        `path-${String(i)}`,
        pathNames[i] ?? "",
        x,
        sy,
        i % 2 === 0 ? -0.4 : 0.4,
        i === guardNode ? "accent" : "ink",
        r,
        true
      );
    }
    const guardReveal = reveals[guardNode] ?? 0;
    if (guardReveal > 0) {
      const ticks = counts.guardChecks;
      const gx = nodeX(guardNode);
      for (let k = 0; k < ticks; k += 1) {
        const x = gx - 0.18 + (k * 0.36) / Math.max(1, ticks - 1);
        const mid = k === Math.floor(ticks / 2);
        const tickTone =
          mid && state === "denied"
            ? tone.denied
            : mid && state === "passed"
              ? tone.markAlt
              : tone.accent;
        seg(x, sy, -0.16, x, sy + 0.14, -0.16, tickTone, 0.7 * guardReveal);
      }
    }
    if (pos >= 0) {
      const px = lerp(pathX0, pathX1, pos);
      const glow =
        state === "denied"
          ? tone.denied
          : state === "passed"
            ? tone.markAlt
            : tone.accent;
      point(px, sy + 0.05, 0, tone.ink, fade, 6);
      point(px, sy + 0.05, 0, glow, 0.35 * fade, 22);
    }
  }

  if (beat.ledgerAlpha > 0) {
    for (const [i, text] of ledgerTexts.entries()) {
      const r =
        smoothstep(i * 0.16, i * 0.16 + 0.14, beat.ledgerProgress) *
        beat.ledgerAlpha;
      if (r <= 0) continue;
      const z = -0.9 + i * 0.36;
      rectY(sy, -1.9, z, 0.26, 0.1, tone.accent, 0.85 * r);
      seg(
        -1.64,
        sy,
        z,
        -1.45,
        sy,
        z,
        tone.white,
        storyPalette.hairStrong * 3 * r
      );
      lab(`ledger-${String(i + 1)}`, text, -1.4, sy, z, "ink", r);
    }
  }

  if (beat.rosterAlpha > 0) {
    for (const [i, [name, count, size, rowTone]] of rosterRows(
      counts
    ).entries()) {
      const r =
        smoothstep(i * 0.14, i * 0.14 + 0.14, beat.rosterProgress) *
        beat.rosterAlpha;
      if (r <= 0) continue;
      const z = -1.35 + i * 0.52;
      const step2 = size * 2 + 0.07;
      for (let k = 0; k < count; k += 1) {
        const kr = clamp01(r * count - k);
        if (kr > 0) {
          rectY(
            sy,
            -1.3 + k * step2 + size,
            z,
            size,
            size * 0.8,
            rowTone,
            0.85 * kr
          );
        }
      }
      lab(`roster-${String(i)}`, name, -1.3, sy, z - 0.2, "ink", r);
    }
  }

  const skillAnchor =
    map && beat.mapAlpha > 0
      ? drawSkills(map, beat.walk, beat.mapAlpha, sy, lab)
      : undefined;

  lab(
    "title",
    beat.sheetTwo ? "harness · sheet 2/2" : "dotfiles · sheet 1/2",
    titleBlock.x,
    floorY,
    titleBlock.z,
    "muted",
    0.9,
    true
  );

  const slabCorner = (i: number): Vec3 => ({
    x: -slab.hx,
    y: (ys[i] ?? 0) + slab.hy,
    z: -slab.hz,
  });
  const plates: Partial<Record<StepId, undefined | Vec3>> = {
    c01: slabCorner(3),
    c02: slabCorner(0),
    c03: slabCorner(1),
    c04: slabCorner(1),
    c05: slabCorner(3),
    c06: slabCorner(2),
    h1: {
      x: lerp(pathX0, pathX1, guardNode / (pathNodes - 1)),
      y: sy,
      z: -0.16,
    },
    h3: { x: -1.3, y: sy, z: -0.83 },
    skills: skillAnchor,
  };

  const { copies } = beat;
  return {
    focus: beat.zoom,
    gridPoints,
    half:
      3.2 + 0.9 * spread + 0.5 * copies - 0.7 * beat.zoom - 0.3 * beat.mapAlpha,
    labels,
    lineColors: lineColorBuf.data.slice(0, lineColorBuf.length),
    lines: lineBuf.data.slice(0, lineBuf.length),
    plate: plates[step],
    points: pointBuf.data.slice(0, pointBuf.length),
    slabSegments,
    span: 2.9 + 1.4 * copies - 0.45 * beat.mapAlpha,
    triColors: triColorBuf.data.slice(0, triColorBuf.length),
    tris: triBuf.data.slice(0, triBuf.length),
  };
};

export const viewMatrix = (
  aspect: number,
  yaw: number,
  pitch: number,
  half = 2.9
): Float32Array => {
  const sy = Math.sin(yaw);
  const cy = Math.cos(yaw);
  const sp = Math.sin(pitch);
  const cp = Math.cos(pitch);
  const zx = sy * cp;
  const zy = sp;
  const zz = cy * cp;
  const xx = cy;
  const xz = -sy;
  const yx = zy * xz;
  const yy = zz * xx - zx * xz;
  const yz = -zy * xx;
  const hw = half * aspect;
  return new Float32Array([
    xx / hw,
    yx / half,
    -zx / depth,
    0,
    0,
    yy / half,
    -zy / depth,
    0,
    xz / hw,
    yz / half,
    -zz / depth,
    0,
    0,
    0,
    0,
    1,
  ]);
};

export const frameMatrix = (
  aspect: number,
  scene: Pick<Scene, "focus" | "half" | "span">,
  yawOffset: number,
  pitchOffset: number
): Float32Array => {
  const half = Math.max(scene.half, scene.span / Math.max(aspect, 0.4));
  const m = viewMatrix(
    aspect,
    isoYaw + yawOffset,
    isoPitch + pitchOffset,
    half
  );
  const wide = clamp01((aspect - 1) / 0.5);
  const tall = clamp01((1 - aspect) / 0.4);
  m[12] = 0.28 * wide;
  m[13] = 0.02 * wide + tallLift * tall + (2.4 * scene.focus) / half;
  return m;
};

export const project = (
  m: Float32Array,
  p: Vec3,
  width: number,
  height: number
): [number, number] => {
  const cx =
    (m[0] ?? 0) * p.x + (m[4] ?? 0) * p.y + (m[8] ?? 0) * p.z + (m[12] ?? 0);
  const cy =
    (m[1] ?? 0) * p.x + (m[5] ?? 0) * p.y + (m[9] ?? 0) * p.z + (m[13] ?? 0);
  const cw =
    (m[3] ?? 0) * p.x + (m[7] ?? 0) * p.y + (m[11] ?? 0) * p.z + (m[15] ?? 1);
  return [((cx / cw + 1) / 2) * width, ((1 - cy / cw) / 2) * height];
};
