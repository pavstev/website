import { deg, smoothstep } from "./math.ts";
import { landmarkCount } from "./sky-scene.ts";

export interface LandmarkMeta {
  box: Box3;
  id: number;
  x: number;
  z: number;
}

export interface Skyline {
  count: number;
  geometry: Float32Array;
  landmarks: readonly LandmarkMeta[];
  lightCount: number;
  lights: Float32Array;
  wheel: WheelMeta;
}

type Box3 = [number, number, number, number, number, number];

type Edges = readonly [boolean, boolean, boolean];
interface Part {
  distance: number;
  id: number;
  vertices: number[];
}
interface Place {
  x: number;
  yaw: number;
  z: number;
}
type QuadEdges = readonly [boolean, boolean, boolean, boolean];
type Vec2 = readonly [number, number];

type Vec3 = readonly [number, number, number];

interface WheelMeta {
  axle: Vec3;
  hub: Vec3;
}

export const skylineStride = 12;

const allEdges: Edges = [true, true, true];
const allQuad: QuadEdges = [true, true, true, true];
const ringQuad: QuadEdges = [true, false, true, false];
const beamQuad: QuadEdges = [false, true, false, true];
const noQuad: QuadEdges = [false, false, false, false];
const crestQuad: QuadEdges = [false, false, true, false];
const floodLevels = [
  1.3, 0.8, 0.35, 0, 0.9, 1.2, 0, 1.2, 1.3, 1.2, 0, 0, 0.5, 0, 0.6, 1.1, 0, 0,
];
const blockKeep: ReadonlyArray<readonly [number, number]> = [
  [0, 160],
  [1, 120],
  [4, 110],
  [5, 170],
  [2, 60],
  [3, 70],
  [6, 90],
  [7, 130],
  [8, 110],
  [9, 170],
  [10, 80],
  [11, 60],
  [12, 100],
  [13, 50],
  [14, 160],
  [15, 190],
];
const blockRings: ReadonlyArray<
  readonly [number, number, number, number, boolean]
> = [
  [1400, 2800, 96, 78, true],
  [2800, 5600, 200, 172, true],
  [5600, 9300, 420, 370, false],
];
const wheelRadius = 30.5;
const wheelHub = 34.5;

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const dot = (a: Vec3, b: Vec3): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const norm = (a: Vec3): Vec3 => {
  const length = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
};

const flip = (a: Vec3): Vec3 => [-a[0], -a[1], -a[2]];

const ringPoly = (
  sides: number,
  radius: number,
  cx: number,
  cz: number,
  rz = radius,
  turn = 0
): Vec2[] =>
  Array.from({ length: sides }, (_, i) => {
    const t = (i / sides) * Math.PI * 2 + turn;
    return [cx + Math.cos(t) * radius, cz + Math.sin(t) * rz] as const;
  });

const rect = (cx: number, cz: number, w: number, d: number): Vec2[] => [
  [cx - w / 2, cz - d / 2],
  [cx + w / 2, cz - d / 2],
  [cx + w / 2, cz + d / 2],
  [cx - w / 2, cz + d / 2],
];

const at = (list: readonly Vec2[], index: number): Vec2 =>
  list[((index % list.length) + list.length) % list.length] ?? [0, 0];

const edgeCode = (edges: Edges): number =>
  (edges[0] ? 1 : 0) + (edges[1] ? 2 : 0) + (edges[2] ? 4 : 0);

const createBuilder = (): {
  beam: (a: Vec3, b: Vec3, thick: number) => void;
  begin: (id: number, distance: number) => void;
  box: (
    cx: number,
    cz: number,
    w: number,
    d: number,
    y0: number,
    y1: number,
    k?: number
  ) => void;
  cyl: (
    cx: number,
    cz: number,
    r: number,
    y0: number,
    y1: number,
    k?: number,
    sides?: number,
    cap?: boolean
  ) => void;
  dome: (
    cx: number,
    cz: number,
    r: number,
    y0: number,
    h: number,
    sides?: number,
    rings?: number
  ) => void;
  ellip: (
    cx: number,
    y0: number,
    cz: number,
    r: number,
    h: number,
    sides: number,
    rings: number,
    lat0: number,
    lat1: number
  ) => void;
  gable: (
    cx: number,
    cz: number,
    w: number,
    d: number,
    yEave: number,
    yRidge: number,
    alongZ?: boolean
  ) => void;
  light: (p: Vec3, phase: number) => void;
  lights: number[];
  mat: (material: number, wheel?: number, random?: number) => void;
  parts: Part[];
  place: (place: Place) => void;
  prism: (
    poly: readonly Vec2[],
    y0: number,
    y1: number,
    k: number,
    cap?: boolean,
    smoothNormals?: boolean
  ) => void;
  quad: (
    a: Vec3,
    b: Vec3,
    c: Vec3,
    d: Vec3,
    hint: Vec3,
    edges?: QuadEdges
  ) => void;
  spire: (cx: number, cz: number, r: number, y0: number, y1: number) => void;
} => {
  const parts: Part[] = [];
  const lights: number[] = [];
  let current: Part = { distance: 0, id: 0, vertices: [] };
  let frame: Place = { x: 0, yaw: 0, z: 0 };
  let info: [number, number, number, number] = [0, 0, 0, 0];

  const toWorld = (p: Vec3): Vec3 => {
    const c = Math.cos(frame.yaw);
    const s = Math.sin(frame.yaw);
    return [frame.x + c * p[0] + s * p[2], p[1], frame.z - s * p[0] + c * p[2]];
  };
  const turn = (p: Vec3): Vec3 => {
    const c = Math.cos(frame.yaw);
    const s = Math.sin(frame.yaw);
    return [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]];
  };

  const tri = (
    a: Vec3,
    b: Vec3,
    c: Vec3,
    hint: Vec3,
    edges: Edges,
    normals?: readonly [Vec3, Vec3, Vec3]
  ): void => {
    const pa = toWorld(a);
    let pb = toWorld(b);
    let pc = toWorld(c);
    const ph = toWorld(hint);
    const raw = cross(sub(pb, pa), sub(pc, pa));
    if (Math.hypot(raw[0], raw[1], raw[2]) < 1e-9) return;
    const face = norm(raw);
    let na = normals ? turn(normals[0]) : face;
    let nb = normals ? turn(normals[1]) : face;
    let nc = normals ? turn(normals[2]) : face;
    let mask: Edges = edges;
    const middle: Vec3 = [
      (pa[0] + pb[0] + pc[0]) / 3,
      (pa[1] + pb[1] + pc[1]) / 3,
      (pa[2] + pb[2] + pc[2]) / 3,
    ];
    if (dot(face, sub(middle, ph)) < 0) {
      [pb, pc] = [pc, pb];
      [nb, nc] = [nc, nb];
      if (!normals) {
        na = flip(na);
        nb = flip(nb);
        nc = flip(nc);
      }
      mask = [edges[2], edges[1], edges[0]];
    }
    const code = edgeCode(mask) * 3;
    const corners: ReadonlyArray<readonly [Vec3, Vec3]> = [
      [pa, na],
      [pb, nb],
      [pc, nc],
    ];
    for (const [index, [p, n]] of corners.entries()) {
      current.vertices.push(
        p[0],
        p[1],
        p[2],
        n[0],
        n[1],
        n[2],
        ...info,
        code + index,
        floodLevels[info[0]] ?? 0
      );
    }
  };

  const quad = (
    a: Vec3,
    b: Vec3,
    c: Vec3,
    d: Vec3,
    hint: Vec3,
    normals?: readonly [Vec3, Vec3, Vec3, Vec3],
    edges: QuadEdges = allQuad
  ): void => {
    tri(
      a,
      b,
      c,
      hint,
      [edges[0], edges[1], false],
      normals ? [normals[0], normals[1], normals[2]] : undefined
    );
    tri(
      a,
      c,
      d,
      hint,
      [false, edges[2], edges[3]],
      normals ? [normals[0], normals[2], normals[3]] : undefined
    );
  };

  const prism = (
    poly: readonly Vec2[],
    y0: number,
    y1: number,
    k: number,
    cap = true,
    smoothNormals = false
  ): void => {
    let cx = 0;
    let cz = 0;
    for (const p of poly) {
      cx += p[0];
      cz += p[1];
    }
    cx /= poly.length;
    cz /= poly.length;
    const hint: Vec3 = [cx, y0 + (y1 - y0) * 0.25, cz];
    const top = (p: Vec2): Vec3 => [
      cx + (p[0] - cx) * k,
      y1,
      cz + (p[1] - cz) * k,
    ];
    const slope = (p: Vec2): Vec3 => {
      const dx = p[0] - cx;
      const dz = p[1] - cz;
      const r = Math.hypot(dx, dz) || 1;
      return norm([dx / r, ((1 - k) * r) / Math.max(y1 - y0, 0.01), dz / r]);
    };
    for (const [i, p] of poly.entries()) {
      const q = at(poly, i + 1);
      const a: Vec3 = [p[0], y0, p[1]];
      const b: Vec3 = [q[0], y0, q[1]];
      if (k <= 0) {
        tri(
          a,
          b,
          [cx, y1, cz],
          hint,
          smoothNormals ? [false, false, true] : allEdges,
          smoothNormals ? [slope(p), slope(q), [0, 1, 0]] : undefined
        );
      } else {
        quad(
          a,
          b,
          top(q),
          top(p),
          hint,
          smoothNormals ? [slope(p), slope(q), slope(q), slope(p)] : undefined,
          smoothNormals ? ringQuad : allQuad
        );
      }
    }
    if (cap && k > 0) {
      for (const [i, p] of poly.entries())
        tri(
          [cx, y1, cz],
          top(p),
          top(at(poly, i + 1)),
          [cx, y1 - 1, cz],
          [false, true, false]
        );
    }
  };

  const box = (
    cx: number,
    cz: number,
    w: number,
    d: number,
    y0: number,
    y1: number,
    k = 1
  ): void => {
    prism(rect(cx, cz, w, d), y0, y1, k);
  };

  const cyl = (
    cx: number,
    cz: number,
    r: number,
    y0: number,
    y1: number,
    k = 1,
    sides = 28,
    cap = true
  ): void => {
    prism(ringPoly(sides, r, cx, cz), y0, y1, k, cap, true);
  };

  const gable = (
    cx: number,
    cz: number,
    w: number,
    d: number,
    yEave: number,
    yRidge: number,
    alongZ = false
  ): void => {
    const hint: Vec3 = [cx, yEave, cz];
    const x0 = cx - w / 2;
    const x1 = cx + w / 2;
    const z0 = cz - d / 2;
    const z1 = cz + d / 2;
    if (alongZ) {
      quad(
        [x0, yEave, z0],
        [x0, yEave, z1],
        [cx, yRidge, z1],
        [cx, yRidge, z0],
        hint
      );
      quad(
        [x1, yEave, z0],
        [x1, yEave, z1],
        [cx, yRidge, z1],
        [cx, yRidge, z0],
        hint
      );
      tri([x0, yEave, z0], [x1, yEave, z0], [cx, yRidge, z0], hint, allEdges);
      tri([x0, yEave, z1], [x1, yEave, z1], [cx, yRidge, z1], hint, allEdges);
      return;
    }
    quad(
      [x0, yEave, z0],
      [x1, yEave, z0],
      [x1, yRidge, cz],
      [x0, yRidge, cz],
      hint
    );
    quad(
      [x0, yEave, z1],
      [x1, yEave, z1],
      [x1, yRidge, cz],
      [x0, yRidge, cz],
      hint
    );
    tri([x0, yEave, z0], [x0, yEave, z1], [x0, yRidge, cz], hint, allEdges);
    tri([x1, yEave, z0], [x1, yEave, z1], [x1, yRidge, cz], hint, allEdges);
  };

  const beam = (a: Vec3, b: Vec3, thick: number): void => {
    const d = sub(b, a);
    const up: Vec3 =
      Math.abs(d[1]) < 0.9 * Math.hypot(d[0], d[1], d[2])
        ? [0, 1, 0]
        : [1, 0, 0];
    const u = norm(cross(d, up));
    const v = norm(cross(d, u));
    const h = thick / 2;
    const corners: Vec3[] = [
      [1, 1],
      [-1, 1],
      [-1, -1],
      [1, -1],
    ].map(([s = 0, t = 0]) => [
      u[0] * s * h + v[0] * t * h,
      u[1] * s * h + v[1] * t * h,
      u[2] * s * h + v[2] * t * h,
    ]);
    const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    for (const [i, p] of corners.entries()) {
      const q = corners[(i + 1) % 4] ?? p;
      quad(
        [a[0] + p[0], a[1] + p[1], a[2] + p[2]],
        [a[0] + q[0], a[1] + q[1], a[2] + q[2]],
        [b[0] + q[0], b[1] + q[1], b[2] + q[2]],
        [b[0] + p[0], b[1] + p[1], b[2] + p[2]],
        mid,
        undefined,
        beamQuad
      );
    }
  };

  const ellip = (
    cx: number,
    y0: number,
    cz: number,
    r: number,
    h: number,
    sides: number,
    rings: number,
    lat0: number,
    lat1: number
  ): void => {
    const point = (la: number, lo: number): Vec3 => [
      cx + Math.cos(la) * Math.cos(lo) * r,
      y0 + Math.sin(la) * h,
      cz + Math.cos(la) * Math.sin(lo) * r,
    ];
    const normal = (la: number, lo: number): Vec3 =>
      norm([
        (Math.cos(la) * Math.cos(lo)) / r,
        Math.sin(la) / h,
        (Math.cos(la) * Math.sin(lo)) / r,
      ]);
    const hint: Vec3 = [cx, y0, cz];
    for (let i = 0; i < rings; i += 1) {
      const a0 = lat0 + ((lat1 - lat0) * i) / rings;
      const a1 = lat0 + ((lat1 - lat0) * (i + 1)) / rings;
      for (let j = 0; j < sides; j += 1) {
        const b0 = (j / sides) * Math.PI * 2;
        const b1 = ((j + 1) / sides) * Math.PI * 2;
        quad(
          point(a0, b0),
          point(a0, b1),
          point(a1, b1),
          point(a1, b0),
          hint,
          [normal(a0, b0), normal(a0, b1), normal(a1, b1), normal(a1, b0)],
          noQuad
        );
      }
    }
  };

  const dome = (
    cx: number,
    cz: number,
    r: number,
    y0: number,
    h: number,
    sides = 28,
    rings = 8
  ): void => {
    ellip(cx, y0, cz, r, h, sides, rings, 0, Math.PI / 2);
  };

  const spire = (
    cx: number,
    cz: number,
    r: number,
    y0: number,
    y1: number
  ): void => {
    const base = ringPoly(8, r, cx, cz, r, Math.PI / 8);
    for (const p of base) beam([p[0], y0, p[1]], [cx, y1, cz], r * 0.22);
    for (let k = 1; k < 5; k += 1) {
      const y = y0 + ((y1 - y0) * k) / 5;
      const rr = r * (1 - k / 5);
      const ring = ringPoly(8, rr, cx, cz, rr, Math.PI / 8);
      for (const [i, p] of ring.entries()) {
        const q = at(ring, i + 1);
        beam([p[0], y, p[1]], [q[0], y, q[1]], r * 0.12);
      }
    }
    prism(
      ringPoly(8, r * 0.3, cx, cz, r * 0.3, Math.PI / 8),
      y1 - (y1 - y0) * 0.12,
      y1 + 2,
      0
    );
  };

  return {
    beam,
    begin: (id, distance) => {
      current = { distance, id, vertices: [] };
      parts.push(current);
      info = [id, 0, 0, 0];
    },
    box,
    cyl,
    dome,
    ellip,
    gable,
    light: (p, phase) => {
      const w = toWorld(p);
      lights.push(w[0], w[1] + 1.5, w[2], 0, 1, 0, info[0], 99, 0, phase, 0, 0);
    },
    lights,
    mat: (material, wheel = 0, random = 0) => {
      info = [info[0], material, wheel, random];
    },
    parts,
    place: (next) => {
      frame = next;
    },
    prism,
    quad: (a, b, c, d, hint, edges = allQuad) => {
      quad(a, b, c, d, hint, undefined, edges);
    },
    spire,
  };
};

type Builder = ReturnType<typeof createBuilder>;

const placeAt = (angle: number, distance: number, yaw = 0): Place => ({
  x: Math.sin(angle * deg) * distance,
  yaw: angle * deg + yaw,
  z: Math.cos(angle * deg) * distance,
});

const porticoDepth = 12;

const portico = (
  b: Builder,
  cz: number,
  w: number,
  h: number,
  columns: number
): void => {
  const d = porticoDepth;
  for (let i = 0; i < columns; i += 1)
    b.cyl(
      -w / 2 + 2 + ((w - 4) * i) / (columns - 1),
      cz - d / 2 + 1.5,
      1.1,
      0,
      h,
      1,
      10,
      false
    );
  b.box(0, cz + 1, w, d - 2, 0, h);
  b.box(0, cz, w + 1, d, h, h + 2.5);
  b.gable(0, cz, w + 1, d, h + 2.5, h + 8, true);
};

const landmarkBuilds: ReadonlyArray<
  readonly [number, number, number, (b: Builder) => void]
> = [
  [
    -6,
    1980,
    0,
    (b) => {
      b.mat(0);
      b.box(0, 0, 107, 34, 0, 28);
      b.mat(1);
      b.gable(0, 0, 107, 34, 28, 64);
      b.mat(0);
      b.prism(
        ringPoly(12, 15, 53.5, 0, 15, 0).filter((p) => p[0] >= 53.4),
        0,
        26,
        1
      );
      b.box(10, -24, 15, 15, 0, 60);
      for (const s of [-1, 1])
        for (const t of [-1, 1])
          b.prism(ringPoly(6, 1.2, 10 + s * 7, -24 + t * 7), 60, 72, 0);
      b.prism(ringPoly(8, 8, 10, -24, 8, Math.PI / 8), 60, 100, 0.66);
      b.prism(ringPoly(8, 5.3, 10, -24, 5.3, Math.PI / 8), 100, 136, 0);
      for (let i = 0; i < 8; i += 1) {
        const t = (i / 8) * Math.PI * 2;
        b.prism(
          ringPoly(6, 0.9, 10 + Math.cos(t) * 6.6, -24 + Math.sin(t) * 6.6),
          92,
          104,
          0
        );
      }
      for (const s of [-1, 1]) {
        b.box(10 + s * 6, -32, 2.2, 2.2, 52, 74, 0.5);
        b.prism(rect(10 + s * 6, -32, 2.2, 2.2), 74, 82, 0);
      }
      b.box(10, 24, 13, 13, 0, 52);
      b.mat(2);
      b.dome(10, 24, 6.5, 52, 9, 20, 6);
      b.cyl(10, 24, 1.6, 61, 63, 1, 10);
      b.prism(ringPoly(8, 1.5, 10, 24), 63, 69, 0);
      b.mat(0);
      for (const s of [-1, 1]) {
        b.box(-50, s * 9, 7, 7, 0, 52);
        b.mat(1);
        b.prism(ringPoly(8, 3.5, -50, s * 9), 52, 66, 0);
        b.mat(0);
      }
      b.box(-56, 0, 10, 12, 0, 40);
      b.mat(1);
      b.gable(-56, 0, 10, 12, 40, 50, true);
    },
  ],
  [
    24,
    3000,
    0.65,
    (b) => {
      const steps = 72;
      const rim = (t: number, z: number): Vec3 => [
        Math.cos(t) * wheelRadius,
        wheelHub + Math.sin(t) * wheelRadius,
        z,
      ];
      b.mat(5, 1);
      for (const z of [-3, 3])
        for (let i = 0; i < steps; i += 1)
          b.beam(
            rim((i / steps) * Math.PI * 2, z),
            rim(((i + 1) / steps) * Math.PI * 2, z),
            1
          );
      for (let i = 0; i < 30; i += 1) {
        const t = (i / 30) * Math.PI * 2;
        b.beam([0, wheelHub, -3], rim(t, -3), 0.35);
        b.beam([0, wheelHub, 3], rim(t + Math.PI / 30, 3), 0.35);
      }
      b.mat(6, 1);
      for (let i = 0; i < 15; i += 1) {
        const p = rim((i / 15) * Math.PI * 2 + 0.1, 0);
        b.box(p[0], 0, 5.4, 5.2, p[1] - 1.5, p[1] + 1.5);
      }
      b.mat(5, 0);
      for (const z of [-6, 6]) {
        b.beam([-17, 0, z], [0, wheelHub, z * 0.6], 1.4);
        b.beam([17, 0, z], [0, wheelHub, z * 0.6], 1.4);
      }
      b.box(0, 0, 3, 10, wheelHub - 1.5, wheelHub + 1.5);
      b.mat(8);
      b.box(0, 0, 50, 14, 0, 6);
      b.mat(9);
      b.box(0, 0, 50, 14, 6, 9, 0.8);
    },
  ],
  [
    28.5,
    5820,
    0,
    (b) => {
      b.mat(4);
      b.cyl(0, 0, 9, 0, 8, 0.55);
      b.cyl(0, 0, 4.6, 0, 142, 0.74, 24, false);
      b.cyl(0, 0, 4, 140, 151, 3.6, 32, false);
      b.mat(3);
      b.cyl(0, 0, 14.4, 151, 171, 1, 36, false);
      b.mat(4);
      b.cyl(0, 0, 14.4, 171, 176, 0.62, 36);
      b.cyl(0, 0, 4, 176, 184, 0.9, 16);
      b.mat(5);
      b.cyl(0, 0, 1.8, 184, 252, 0.15, 10);
      b.light([0, 252, 0], 0.1);
      b.light([0, 184, 0], 0.6);
    },
  ],
  [
    34.5,
    5190,
    -0.35,
    (b) => {
      b.mat(3);
      const poly: Vec2[] = [
        [-32, 13],
        [-32, -13],
      ];
      for (let i = 1; i < 8; i += 1)
        poly.push([-32 + i * 8, -13 - (i % 2) * 3]);
      poly.push([32, -13], [32, 13]);
      b.prism(poly.toReversed(), 0, 220, 1);
      b.mat(5);
      b.beam([6, 220, 0], [6, 250, 0], 1.6);
      b.light([6, 250, 0], 0.35);
      b.light([-30, 221, 0], 0.85);
      b.light([30, 221, 0], 0.85);
    },
  ],
  [
    -33,
    1000,
    0,
    (b) => {
      b.mat(0);
      b.box(0, 10, 60, 34, 0, 30);
      portico(b, -12, 26, 22, 6);
      b.mat(0);
      b.cyl(0, 10, 12.5, 30, 44, 1, 32, false);
      b.mat(2);
      b.dome(0, 10, 12.5, 44, 21, 32, 8);
      b.mat(0);
      b.cyl(0, 10, 2.4, 65, 71, 1, 12);
      b.mat(2);
      b.cyl(0, 10, 2.6, 71, 77, 0, 12);
      for (const s of [-1, 1]) {
        b.mat(0);
        b.cyl(s * 20, -10, 3.4, 0, 41, 1, 20, false);
        b.cyl(s * 20, -10, 3.4, 41, 44, 1.2, 20);
        b.mat(2);
        b.dome(s * 20, -10, 3.6, 44, 4, 16, 4);
        b.mat(0);
        b.box(s * 35, 0, 10, 10, 0, 34);
        b.mat(2);
        b.prism(rect(s * 35, 0, 10, 10), 34, 41, 0);
      }
    },
  ],
  [
    -30,
    2770,
    0,
    (b) => {
      b.mat(0);
      b.box(0, 0, 150, 70, 0, 27);
      b.mat(9);
      b.gable(0, 0, 150, 70, 27, 37);
      b.mat(0);
      b.box(0, -36, 16, 16, 0, 64);
      b.prism(ringPoly(8, 7.5, 0, -36, 7.5, Math.PI / 8), 64, 84, 0.8);
      b.mat(9);
      b.prism(ringPoly(8, 6, 0, -36, 6, Math.PI / 8), 84, 98, 0);
      b.mat(0);
      b.beam([0, 98, -36], [0, 104, -36], 0.8);
      for (const s of [-1, 1])
        for (const z of [-34, 30]) {
          b.mat(0);
          b.box(s * 40, z, 8, 8, 0, 44);
          b.mat(9);
          b.prism(rect(s * 40, z, 8, 8), 44, 58, 0);
        }
    },
  ],
  [
    11,
    5420,
    0.3,
    (b) => {
      b.mat(3);
      b.cyl(0, 0, 18, 0, 171, 1, 32);
      b.cyl(12, 10, 14, 0, 150, 1, 28);
      b.mat(4);
      b.box(40, 20, 60, 50, 0, 38);
      b.mat(5);
      b.beam([0, 171, 0], [0, 202, 0], 1.4);
      b.light([0, 202, 0], 0.55);
    },
  ],
  [
    -19.5,
    2130,
    0.2,
    (b) => {
      b.mat(0);
      b.box(0, 0, 110, 34, 0, 24);
      b.mat(9);
      b.gable(0, 0, 110, 34, 24, 31);
      b.mat(0);
      b.prism(
        [
          ...ringPoly(24, 20, 0, -14, 9, 0).filter((p) => p[1] <= -14.01),
          [20, -6],
          [-20, -6],
        ],
        0,
        26,
        1
      );
      b.cyl(0, -6, 11, 26, 36, 1, 28, false);
      b.mat(2);
      b.dome(0, -6, 11.5, 36, 15, 28, 8);
      b.cyl(0, -6, 2, 51, 56, 1, 10);
      b.prism(ringPoly(10, 2.3, 0, -6), 56, 61, 0);
      b.mat(0);
      b.box(70, 20, 50, 30, 0, 26);
      b.mat(2);
      b.dome(78, 14, 7, 26, 8, 20, 5);
    },
  ],
  [
    -24,
    3120,
    0,
    (b) => {
      b.mat(0);
      b.box(0, 25, 26, 80, 0, 26);
      b.mat(9);
      b.gable(0, 25, 26, 80, 26, 44, true);
      b.mat(0);
      b.box(0, -10, 34, 12, 0, 30);
      for (const s of [-1, 1]) {
        b.mat(0);
        b.box(s * 12, -14, 10, 10, 0, 52);
        b.prism(ringPoly(8, 5.2, s * 12, -14, 5.2, Math.PI / 8), 52, 64, 0.92);
        b.mat(4);
        b.spire(s * 12, -14, 4.8, 64, 99);
      }
      b.mat(0);
      b.prism(ringPoly(8, 4, 0, 62, 4, Math.PI / 8), 44, 60, 0);
    },
  ],
  [
    -27.5,
    2470,
    0,
    (b) => {
      b.mat(0);
      b.box(0, 10, 150, 70, 0, 22);
      b.mat(9);
      b.box(0, 10, 150, 70, 22, 25, 0.96);
      b.mat(0);
      portico(b, -32, 44, 20, 8);
      for (const s of [-1, 1]) {
        b.box(s * 52, -26, 30, 12, 0, 26);
        b.mat(5);
        b.box(s * 52, -26, 6, 4, 26, 32);
        b.mat(0);
      }
      b.mat(5);
      for (const s of [-1, 1]) b.box(s * 66, -26, 4, 4, 22, 27);
    },
  ],
  [
    6,
    2370,
    0.4,
    (b) => {
      b.mat(12);
      const poly = ringPoly(28, 24, 0, 0, 15, 0.3);
      b.prism(poly, 0, 64, 1, true, true);
      b.prism(poly, 64, 75, 0.82, true, true);
      b.mat(4);
      b.box(0, 0, 70, 40, 0, 12);
    },
  ],
  [
    31,
    5000,
    0.2,
    (b) => {
      b.mat(3);
      b.box(0, 0, 32, 30, 0, 86);
      b.box(4, 2, 24, 22, 86, 100);
      b.mat(5);
      b.beam([0, 100, 0], [0, 108, 0], 0.8);
      b.light([0, 108, 0], 0.15);
    },
  ],
  [
    -11.5,
    4990,
    0,
    (b) => {
      b.mat(11);
      b.box(0, 10, 80, 40, 0, 30);
      b.gable(0, 10, 80, 40, 30, 38);
      b.mat(4);
      b.cyl(20, -5, 4.5, 0, 126, 0.7, 20);
      b.mat(10);
      b.ellip(20, 76, -5, 9, 9, 28, 12, -Math.PI / 2, Math.PI / 2);
      b.mat(11);
      b.cyl(-25, 0, 3, 30, 40, 1, 12);
      b.mat(10);
      b.ellip(-25, 41, 0, 3.5, 3.5, 16, 6, -Math.PI / 2, Math.PI / 2);
      b.light([20, 126, -5], 0.45);
    },
  ],
  [
    -14.5,
    2980,
    0,
    (b) => {
      b.mat(3);
      b.box(0, 0, 24, 24, 0, 66);
      b.mat(13);
      b.box(0, 0, 24.2, 24.2, 66, 72);
      b.mat(5);
      b.beam([0, 72, 0], [0, 78, 0], 0.6);
    },
  ],
  [
    -21,
    820,
    0,
    (b) => {
      b.mat(0);
      b.box(0, 0, 150, 22, 0, 14);
      b.mat(2);
      b.box(0, 0, 150, 22, 14, 19, 0.82);
      b.mat(0);
      b.box(0, -2, 34, 26, 0, 17);
      b.mat(2);
      b.dome(0, -2, 13, 17, 8, 24, 5);
      for (const s of [-1, 1]) {
        b.mat(0);
        b.box(s * 64, 0, 20, 26, 0, 16);
        b.mat(2);
        b.box(s * 64, 0, 20, 26, 16, 22, 0.6);
      }
    },
  ],
  [
    -36.5,
    1970,
    0,
    (b) => {
      b.mat(0);
      b.box(0, 0, 170, 70, 0, 26);
      b.mat(9);
      b.box(0, 0, 170, 70, 26, 29, 0.95);
      b.cyl(0, 0, 15, 29, 40, 1, 28, false);
      b.mat(2);
      b.dome(0, 0, 15, 40, 20, 28, 8);
      b.cyl(0, 0, 2.5, 60, 66, 1, 12);
      b.prism(ringPoly(10, 2.8, 0, 0), 66, 72, 0);
      for (const s of [-1, 1])
        for (const t of [-1, 1]) {
          b.mat(2);
          b.dome(s * 70, t * 28, 5, 29, 6, 16, 4);
        }
    },
  ],
];

const ridgeHeight = (angle: number): number =>
  (215 +
    95 * Math.exp(-(((angle + 12) / 7) ** 2)) +
    45 * Math.exp(-(((angle + 6) / 2.6) ** 2)) -
    30 * Math.exp(-(((angle + 9) / 2) ** 2)) +
    22 * Math.sin(angle * 0.31)) *
  smoothstep(-1, -5, angle) *
  (0.55 + 0.45 * smoothstep(-60, -40, angle));

const toward = (angle: number, d: number, y: number): Vec3 => [
  Math.sin(angle * deg) * d,
  y,
  Math.cos(angle * deg) * d,
];

const ridge = (b: Builder): void => {
  b.place({ x: 0, yaw: 0, z: 0 });
  b.begin(16, 10_500);
  b.mat(7);
  const near = 9300;
  const slices = 140;
  for (let i = 0; i < slices; i += 1) {
    const a0 = -70 + i * (69 / slices);
    const a1 = a0 + 69 / slices;
    const am = (a0 + a1) / 2;
    const h0 = ridgeHeight(a0);
    const h1 = ridgeHeight(a1);
    b.quad(
      toward(a0, near, 0),
      toward(a1, near, 0),
      toward(a1, near + 1100, h1),
      toward(a0, near + 1100, h0),
      toward(am, near + 1100, -10),
      crestQuad
    );
    b.quad(
      toward(a0, near + 1100, h0),
      toward(a1, near + 1100, h1),
      toward(a1, near + 2600, h1 * 0.55),
      toward(a0, near + 2600, h0 * 0.55),
      toward(am, near + 1700, -200),
      noQuad
    );
  }
  const mast = -12;
  const top = ridgeHeight(mast);
  b.mat(5);
  b.beam(
    toward(mast, near + 1150, top - 5),
    toward(mast, near + 1150, top + 165),
    4
  );
  b.light(toward(mast, near + 1150, top + 165), 0.2);
  b.light(toward(mast, near + 1150, top + 88), 0.7);
};

const cityBlocks = (b: Builder, metas: readonly LandmarkMeta[]): void => {
  let seed = 7;
  const random = (): number => {
    seed = (seed * 16_807) % 2_147_483_647;
    return (seed - 1) / 2_147_483_646;
  };
  const rot = 0.38;
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  for (const [r0, r1, cell, size, roof] of blockRings) {
    const n = Math.ceil(r1 / cell);
    for (let i = -n; i <= n; i += 1)
      for (let j = -n; j <= n; j += 1) {
        const lx = i * cell;
        const lz = j * cell;
        const x = cr * lx + sr * lz;
        const z = -sr * lx + cr * lz;
        const d = Math.hypot(x, z);
        if (d < r0 || d >= r1 || z <= 0) continue;
        const angle = Math.atan2(x, z) / deg;
        if (Math.abs(angle) > 58) continue;
        const crowded = blockKeep.some(([id, room]) => {
          const meta = metas[id];
          return (
            meta !== undefined &&
            Math.hypot(x - meta.x, z - meta.z) < room + size * 0.6
          );
        });
        if (crowded || random() < 0.07) continue;
        b.place({ x, yaw: rot, z });
        b.begin(17, d);
        const tower = angle > 15 && angle < 40 && d > 4200 && random() < 0.16;
        let height = 19 + random() * 8;
        if (random() < 0.08) height = 28 + random() * 14;
        const facade = random();
        if (tower) {
          b.mat(3, 0, facade);
          b.box(0, 0, size * 0.3, size * 0.25, 0, 60 + random() * 90);
          continue;
        }
        const split = cell < 150 && random() < 0.55;
        const parts: ReadonlyArray<readonly [number, number, number]> = split
          ? [
              [-size / 4, size / 2 - 3, height],
              [size / 4, size / 2 - 3, height * (0.85 + random() * 0.3)],
            ]
          : [[0, size, height]];
        for (const [offset, width, tall] of parts) {
          b.mat(8, 0, facade);
          b.box(offset, 0, width, size, 0, roof ? tall - 3.5 : tall);
          if (!roof) {
            continue;
          }

          b.mat(9, 0, random());
          b.box(offset, 0, width, size, tall - 3.5, tall + 1.5, 0.82);
        }
      }
  }
};

export const buildSkyline = (): Skyline => {
  const b = createBuilder();
  const metas: LandmarkMeta[] = [];
  for (const [id, [angle, distance, yaw, build]] of landmarkBuilds.entries()) {
    const place = placeAt(angle, distance, yaw);
    b.place(place);
    b.begin(id, distance);
    build(b);
    metas[id] = { box: [0, 0, 0, 0, 0, 0], id, x: place.x, z: place.z };
  }
  ridge(b);
  cityBlocks(b, metas);
  const parts = b.parts.toSorted((p, q) => q.distance - p.distance);
  const total = parts.reduce((sum, part) => sum + part.vertices.length, 0);
  const geometry = new Float32Array(total);
  let offset = 0;
  const bounds = new Map<number, Box3>();
  for (const part of parts) {
    geometry.set(part.vertices, offset);
    offset += part.vertices.length;
    if (part.id >= landmarkCount) continue;
    const box = bounds.get(part.id) ?? [
      Infinity,
      Infinity,
      Infinity,
      -Infinity,
      -Infinity,
      -Infinity,
    ];
    for (let i = 0; i < part.vertices.length; i += skylineStride)
      for (let c = 0; c < 3; c += 1) {
        const value = part.vertices[i + c] ?? 0;
        box[c] = Math.min(box[c] ?? value, value);
        box[c + 3] = Math.max(box[c + 3] ?? value, value);
      }
    bounds.set(part.id, box);
  }
  const landmarks = metas.map((meta) => ({
    ...meta,
    box: bounds.get(meta.id) ?? meta.box,
  }));
  const wheel = metas[1] ?? { box: [0, 0, 0, 0, 0, 0], id: 1, x: 0, z: 0 };
  const wheelYaw = placeAt(24, 3000, 0.65).yaw;
  return {
    count: total / skylineStride,
    geometry,
    landmarks,
    lightCount: b.lights.length / skylineStride,
    lights: new Float32Array(b.lights),
    wheel: {
      axle: [Math.sin(wheelYaw), 0, Math.cos(wheelYaw)],
      hub: [wheel.x, wheelHub, wheel.z],
    },
  };
};
