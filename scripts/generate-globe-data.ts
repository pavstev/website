import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

interface Geometry {
  arcs: number[][] | number[][][];
  id?: string;
  type: "MultiPolygon" | "Polygon";
}

type Point = [number, number];

interface Topology {
  arcs: number[][][];
  objects: Record<string, Partial<Geometry> & { geometries?: Geometry[] }>;
  transform: { scale: Point; translate: Point };
}

interface Window {
  east: number;
  north: number;
  south: number;
  west: number;
}

const root = process.cwd();
const austriaId = "040";
const europe: Window = { east: 34, north: 62, south: 34, west: -12 };
const worldStep = 10;
const europeStep = 40;
const worldTolerance = 0.12;
const europeTolerance = 0.012;

const load = (name: string): Topology =>
  JSON.parse(
    readFileSync(
      path.join(root, "node_modules", "world-atlas", `${name}.json`),
      "utf8"
    )
  ) as Topology;

const decodeArcs = (topology: Topology): Point[][] => {
  const [sx, sy] = topology.transform.scale;
  const [tx, ty] = topology.transform.translate;
  return topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx = 0, dy = 0]) => {
      x += dx;
      y += dy;
      return [x * sx + tx, y * sy + ty];
    });
  });
};

const arcPoints = (arcs: Point[][], index: number): Point[] =>
  index >= 0 ? (arcs[index] ?? []) : (arcs[~index] ?? []).toReversed();

const ringPoints = (arcs: Point[][], ring: number[]): Point[] => {
  const points: Point[] = [];
  for (const index of ring) {
    const part = arcPoints(arcs, index);
    points.push(...(points.length > 0 ? part.slice(1) : part));
  }
  return points;
};

const geometryRings = (arcs: Point[][], geometry: Geometry): Point[][] => {
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.arcs as number[][]]
      : (geometry.arcs as number[][][]);
  return polygons.flatMap((polygon) =>
    polygon.map((ring) => ringPoints(arcs, ring))
  );
};

const distanceToSegment = (p: Point, a: Point, b: Point): number => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const t =
    length === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)
        );
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
};

const simplify = (points: Point[], tolerance: number): Point[] => {
  if (points.length < 3) return points;
  const first = points[0] ?? [0, 0];
  const last = points.at(-1) ?? first;
  let far = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const d = distanceToSegment(points[i] ?? first, first, last);
    if (!(d > far)) {
      continue;
    }

    far = d;
    index = i;
  }
  if (far <= tolerance) return [first, last];
  return [
    ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(index), tolerance),
  ];
};

const clipEdge = (
  points: Point[],
  inside: (p: Point) => boolean,
  cross: (a: Point, b: Point) => Point
): Point[] => {
  const result: Point[] = [];
  for (const [i, current] of points.entries()) {
    const previous = points[(i + points.length - 1) % points.length] ?? current;
    if (inside(current)) {
      if (!inside(previous)) result.push(cross(previous, current));
      result.push(current);
    } else if (inside(previous)) {
      result.push(cross(previous, current));
    }
  }
  return result;
};

const clipRing = (ring: Point[], box: Window): Point[] => {
  const atX =
    (x: number) =>
    (a: Point, b: Point): Point => [
      x,
      a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]),
    ];
  const atY =
    (y: number) =>
    (a: Point, b: Point): Point => [
      a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]),
      y,
    ];
  let result = ring;
  result = clipEdge(result, (p) => p[0] >= box.west, atX(box.west));
  result = clipEdge(result, (p) => p[0] <= box.east, atX(box.east));
  result = clipEdge(result, (p) => p[1] >= box.south, atY(box.south));
  result = clipEdge(result, (p) => p[1] <= box.north, atY(box.north));
  return result.length >= 3 ? result : [];
};

const inBox = (p: Point, box: Window): boolean =>
  p[0] >= box.west &&
  p[0] <= box.east &&
  p[1] >= box.south &&
  p[1] <= box.north;

const clipLine = (line: Point[], box: Window): Point[][] => {
  const parts: Point[][] = [];
  let current: Point[] = [];
  for (const point of line) {
    if (inBox(point, box)) current.push(point);
    else {
      if (current.length > 1) parts.push(current);
      current = [];
    }
  }
  if (current.length > 1) parts.push(current);
  return parts;
};

const zigzag = (value: number): number => (value << 1) ^ (value >> 31);

const encode = (points: Point[], step: number): string => {
  let px = 0;
  let py = 0;
  const numbers = points.flatMap(([lon, lat]) => {
    const x = Math.round(lon * step);
    const y = Math.round(lat * step);
    const out = [zigzag(x - px), zigzag(y - py)];
    px = x;
    py = y;
    return out;
  });
  return numbers.map((n) => n.toString(36)).join(",");
};

const dedupe = (points: Point[], step: number): Point[] => {
  const out: Point[] = [];
  let last = "";
  for (const [lon, lat] of points) {
    const key = `${String(Math.round(lon * step))},${String(Math.round(lat * step))}`;
    if (key !== last) out.push([lon, lat]);
    last = key;
  }
  return out;
};

const pack = (
  rings: Point[][],
  step: number,
  tolerance: number,
  minPoints: number
): string[] =>
  rings
    .map((ring) => dedupe(simplify(ring, tolerance), step))
    .filter((ring) => ring.length >= minPoints)
    .map((ring) => encode(ring, step));

const countryGeometries = (topology: Topology): Geometry[] =>
  topology.objects["countries"]?.geometries ?? [];

const landGeometries = (topology: Topology): Geometry[] => {
  const { land } = topology.objects;
  if (land?.geometries) return land.geometries;
  if (land?.type && land.arcs) return [land as Geometry];
  throw new Error("land object missing");
};

const borderLines = (topology: Topology, arcs: Point[][]): Point[][] => {
  const owners = new Map<number, Set<string>>();
  for (const geometry of countryGeometries(topology)) {
    const polygons =
      geometry.type === "Polygon"
        ? [geometry.arcs as number[][]]
        : (geometry.arcs as number[][][]);
    for (const polygon of polygons) {
      for (const ring of polygon) {
        for (const index of ring) {
          const key = index >= 0 ? index : ~index;
          const set = owners.get(key) ?? new Set<string>();
          set.add(geometry.id ?? "");
          owners.set(key, set);
        }
      }
    }
  }
  return [...owners]
    .filter(([, set]) => set.size > 1)
    .map(([index]) => arcs[index] ?? []);
};

const world110 = load("countries-110m");
const land110 = load("land-110m");
const arcs110 = decodeArcs(world110);
const landArcs110 = decodeArcs(land110);

const worldLand = landGeometries(land110).flatMap((geometry) =>
  geometryRings(landArcs110, geometry)
);
const worldAustria = countryGeometries(world110)
  .filter((geometry) => geometry.id === austriaId)
  .flatMap((geometry) => geometryRings(arcs110, geometry));

const world50 = load("countries-50m");
const arcs50 = decodeArcs(world50);
const europeLand: Point[][] = [];
const europeAustria: Point[][] = [];
for (const geometry of countryGeometries(world50)) {
  const rings = geometryRings(arcs50, geometry)
    .map((ring) => clipRing(ring, europe))
    .filter((ring) => ring.length > 0);
  europeLand.push(...rings);
  if (geometry.id === austriaId) europeAustria.push(...rings);
}
const europeBorders = borderLines(world50, arcs50).flatMap((line) =>
  clipLine(line, europe)
);

const data = {
  europe: {
    austria: pack(europeAustria, europeStep, europeTolerance, 3),
    borders: pack(europeBorders, europeStep, europeTolerance, 2),
    bounds: europe,
    land: pack(europeLand, europeStep, europeTolerance, 3),
    step: europeStep,
  },
  world: {
    austria: pack(worldAustria, worldStep, worldTolerance, 3),
    land: pack(worldLand, worldStep, worldTolerance, 3),
    step: worldStep,
  },
};

const source = `interface GlobeLayer {
  austria: string[];
  land: string[];
  step: number;
}

interface GlobeEurope extends GlobeLayer {
  borders: string[];
  bounds: { east: number; north: number; south: number; west: number };
}

interface GlobeData {
  europe: GlobeEurope;
  world: GlobeLayer;
}

export const globeData: GlobeData = ${JSON.stringify(data)};
`;

writeFileSync(path.join(root, "src/lib/globe-data.ts"), source);
console.warn(
  `Wrote src/lib/globe-data.ts (${String(Math.round(source.length / 1024))} KB): ` +
    `${String(data.world.land.length)} world rings, ${String(data.europe.land.length)} europe rings, ${String(data.europe.borders.length)} borders`
);
