export const landMapWidth = 2048;
export const landMapHeight = 1024;
export const landMapPath = "src/assets/land-map.webp";
const landBlurSigma = 1;
const landSubRows = 8;

export type Ring = ReadonlyArray<readonly [number, number]>;

const isRing = (value: unknown): value is Ring =>
  Array.isArray(value) &&
  value.every(
    (point) =>
      Array.isArray(point) &&
      point.length >= 2 &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1])
  );

const ringsOf = (coordinates: unknown): Ring[] =>
  Array.isArray(coordinates) ? coordinates.filter(isRing) : [];

const geometryRings = (geometry: unknown): Ring[] => {
  if (typeof geometry !== "object" || geometry === null) return [];
  const { coordinates, type } = geometry as Record<string, unknown>;
  if (type === "Polygon") return ringsOf(coordinates);
  return type === "MultiPolygon" && Array.isArray(coordinates)
    ? coordinates.flatMap((polygon: unknown) => ringsOf(polygon))
    : [];
};

export const landRings = (geojson: unknown): Ring[] => {
  if (typeof geojson !== "object" || geojson === null) return [];
  const { features, geometry } = geojson as Record<string, unknown>;
  return Array.isArray(features)
    ? features.flatMap((feature: unknown) =>
        typeof feature === "object" && feature !== null
          ? geometryRings((feature as Record<string, unknown>)["geometry"])
          : []
      )
    : geometryRings(geometry ?? geojson);
};

export const projectRing = (ring: Ring, width: number, height: number): Ring =>
  ring.map(([lon, lat]) => [
    ((lon + 180) / 360) * width,
    ((90 - lat) / 180) * height,
  ]);

export const fillRings = (
  rings: readonly Ring[],
  width: number,
  height: number,
  subRows: number = landSubRows
): Float32Array => {
  const crossings: number[][] = Array.from(
    { length: height * subRows },
    () => []
  );
  for (const ring of rings) {
    for (let index = 1; index < ring.length; index += 1) {
      const from = ring[index - 1];
      const to = ring[index];
      if (!from || !to || from[1] === to[1]) continue;
      const top = Math.min(from[1], to[1]);
      const bottom = Math.max(from[1], to[1]);
      const first = Math.max(0, Math.ceil(top * subRows - 0.5));
      const last = Math.min(
        height * subRows - 1,
        Math.ceil(bottom * subRows - 0.5) - 1
      );
      const slope = (to[0] - from[0]) / (to[1] - from[1]);
      for (let row = first; row <= last; row += 1) {
        crossings[row]?.push(
          from[0] + ((row + 0.5) / subRows - from[1]) * slope
        );
      }
    }
  }

  const coverage = new Float32Array(width * height);
  const weight = 1 / subRows;
  for (const [row, xs] of crossings.entries()) {
    xs.sort((a, b) => a - b);
    const base = Math.floor(row / subRows) * width;
    for (let pair = 0; pair + 1 < xs.length; pair += 2) {
      const a = Math.min(width, Math.max(0, xs[pair] ?? 0));
      const b = Math.min(width, Math.max(0, xs[pair + 1] ?? 0));
      if (b <= a) continue;
      const first = Math.floor(a);
      const last = Math.min(width - 1, Math.floor(b));
      if (first === last) {
        coverage[base + first] =
          (coverage[base + first] ?? 0) + (b - a) * weight;
        continue;
      }
      coverage[base + first] =
        (coverage[base + first] ?? 0) + (first + 1 - a) * weight;
      for (let x = first + 1; x < last; x += 1) {
        coverage[base + x] = (coverage[base + x] ?? 0) + weight;
      }
      coverage[base + last] =
        (coverage[base + last] ?? 0) + (b - last) * weight;
    }
  }
  return coverage;
};

const kernelOf = (sigma: number): Float32Array => {
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const kernel = new Float32Array(radius * 2 + 1);
  let total = 0;
  for (let offset = -radius; offset <= radius; offset += 1) {
    const value = Math.exp(-(offset * offset) / (2 * sigma * sigma));
    kernel[offset + radius] = value;
    total += value;
  }
  return kernel.map((value) => value / total);
};

export const blurMask = (
  mask: Float32Array,
  width: number,
  height: number,
  sigma: number = landBlurSigma
): Float32Array => {
  const kernel = kernelOf(sigma);
  const radius = (kernel.length - 1) / 2;
  const across = new Float32Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const at = (((x + k) % width) + width) % width;
        sum += (mask[y * width + at] ?? 0) * (kernel[k + radius] ?? 0);
      }
      across[y * width + x] = sum;
    }
  }
  const down = new Float32Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const at = Math.min(height - 1, Math.max(0, y + k));
        sum += (across[at * width + x] ?? 0) * (kernel[k + radius] ?? 0);
      }
      down[y * width + x] = sum;
    }
  }
  return down;
};

export const landMap = (
  geojson: unknown,
  width: number = landMapWidth,
  height: number = landMapHeight
): Uint8Array => {
  const rings = landRings(geojson).map((ring) =>
    projectRing(ring, width, height)
  );
  const soft = blurMask(fillRings(rings, width, height), width, height);
  return Uint8Array.from(soft, (value) =>
    Math.round(Math.min(1, Math.max(0, value)) * 255)
  );
};
