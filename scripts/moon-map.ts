export const moonMapWidth = 512;
export const moonMapHeight = 256;
export const moonMapPath = "src/assets/moon-map.webp";

type Crater = readonly [
  lat: number,
  lon: number,
  km: number,
  rays: number,
  tone: number,
];
type Mare = readonly [lat: number, lon: number, radius: number, depth: number];

const maria: readonly Mare[] = [
  [32.8, -15.6, 16.5, 1],
  [28, 17.5, 11, 0.95],
  [8.5, 31.4, 11.5, 1],
  [15, 24, 6.5, 0.9],
  [17, 59.1, 8.4, 1],
  [-7.8, 51.3, 9, 0.9],
  [-2, 47, 6, 0.85],
  [-15.2, 35.5, 5.2, 0.9],
  [-21.3, -16.6, 9.5, 0.85],
  [-24.4, -38.6, 6.3, 0.95],
  [42, -58, 10, 0.9],
  [27, -56, 12, 1],
  [12, -54, 12, 1],
  [0, -48, 10, 0.95],
  [-10, -42, 7, 0.9],
  [18, -42, 9, 0.95],
  [7.5, -30.9, 7.5, 0.85],
  [-10, -23.1, 5.8, 0.85],
  [56, -38, 4.5, 0.8],
  [57.5, -14, 5, 0.85],
  [57, 8, 5, 0.85],
  [55.5, 30, 4.5, 0.75],
  [13.3, 3.6, 4, 0.85],
  [2.4, 1.7, 3.2, 0.55],
  [10.9, -8.8, 3.8, 0.75],
  [1.3, 87.5, 5.5, 0.9],
  [13.3, 86.1, 6, 0.8],
  [-38.9, 93, 8, 0.65],
  [38, 29.2, 4.5, 0.55],
  [54, -56.6, 5.5, 0.75],
  [6.8, 68.4, 3.4, 0.7],
  [1.1, 65.1, 2.4, 0.7],
  [26.5, 0.4, 2.8, 0.65],
  [-5.5, -68.3, 2.8, 1.15],
  [51.6, -9.4, 1.6, 1.05],
  [-3, -74.6, 2, 0.8],
  [53.6, 56.5, 1.8, 0.8],
  [44.1, -31.5, 3.6, 0.55],
];

const craters: readonly Crater[] = [
  [-43.31, -11.36, 85, 46, 0.42],
  [9.62, -20.08, 96, 26, 0.3],
  [8.12, -38.01, 31, 16, 0.3],
  [23.73, -47.49, 40, 9, 0.55],
  [16.1, 46.8, 28, 16, 0.32],
  [-32.5, 54.2, 74, 14, 0.2],
  [-36, 60.6, 125, 0, 0],
  [8.4, -77.6, 43, 18, 0.25],
  [73.4, -10.1, 51, 12, 0.22],
  [16.3, 16, 26, 0, 0.35],
  [14.45, 9.06, 38, 0, 0.18],
  [-58.62, -14.73, 231, 0, 0],
  [-9.16, -1.84, 154, 0, 0],
  [-13.39, -2.85, 119, 0, 0],
  [-18.26, -1.93, 97, 0, 0],
  [-11.45, 26.28, 99, 0, 0.12],
  [-13.2, 24, 98, 0, 0],
  [-17.98, 23.55, 99, 0, 0],
  [-8.86, 61.04, 132, 0, 0.1],
  [-25.38, 60.4, 177, 0, 0],
  [31.88, 29.99, 95, 0, 0],
  [14.47, -11.32, 58, 0, 0],
  [29.72, -3.99, 81, 0, 0],
  [50.24, 17.32, 87, 0, 0],
  [44.27, 16.23, 67, 0, 0],
  [-17.55, -39.96, 110, 0, 0],
  [-44.4, -55.1, 206, 0, 0],
  [-50.5, -6.2, 194, 0, 0],
  [-49.6, -21.8, 145, 0, 0],
  [-11.24, 4.01, 129, 0, 0],
  [-5.11, 5.2, 138, 0, 0],
  [-33.1, 1, 128, 0, 0],
  [-45.4, 41.5, 190, 0, 0],
  [-41.8, 14, 114, 0, 0],
  [-41.1, 6, 126, 0, 0],
  [-29.9, -13.5, 106, 0, 0],
  [-20.7, -22.2, 61, 0, 0.1],
  [2.2, -67.6, 115, 0, 0],
  [46.7, 44.4, 87, 0, 0],
  [46.7, 39.1, 69, 0, 0],
  [27.6, 55.5, 125, 0, 0],
  [21.3, 46, 63, 0, 0],
  [-23.4, 26.3, 27, 0, 0.2],
  [-21.7, -49.4, 40, 8, 0.15],
];

const deg = Math.PI / 180;
const moonKm = 1737.4;

const hash = (x: number, y: number, z: number): number => {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43_758.5453123;
  return h - Math.floor(h);
};

const smoothRamp = (t: number): number => t * t * (3 - 2 * t);

const noise3 = (x: number, y: number, z: number): number => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = smoothRamp(x - ix);
  const fy = smoothRamp(y - iy);
  const fz = smoothRamp(z - iz);
  const v = (dx: number, dy: number, dz: number): number =>
    hash(ix + dx, iy + dy, iz + dz);
  const a = v(0, 0, 0) + (v(1, 0, 0) - v(0, 0, 0)) * fx;
  const b = v(0, 1, 0) + (v(1, 1, 0) - v(0, 1, 0)) * fx;
  const c = v(0, 0, 1) + (v(1, 0, 1) - v(0, 0, 1)) * fx;
  const d = v(0, 1, 1) + (v(1, 1, 1) - v(0, 1, 1)) * fx;
  const e = a + (b - a) * fy;
  const f = c + (d - c) * fy;
  return e + (f - e) * fz;
};

const fbm3 = (x: number, y: number, z: number, octaves: number): number => {
  let sum = 0;
  let amp = 0.5;
  let fx = x;
  let fy = y;
  let fz = z;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(fx, fy, fz);
    fx = fx * 2.03 + 1.7;
    fy = fy * 2.03 + 9.2;
    fz = fz * 2.03 + 3.1;
    amp *= 0.5;
  }
  return sum;
};

const unit = (lat: number, lon: number): [number, number, number] => [
  Math.cos(lat * deg) * Math.sin(lon * deg),
  Math.sin(lat * deg),
  Math.cos(lat * deg) * Math.cos(lon * deg),
];

const angle = (a: readonly number[], b: readonly number[]): number =>
  Math.acos(
    Math.min(
      1,
      Math.max(
        -1,
        (a[0] ?? 0) * (b[0] ?? 0) +
          (a[1] ?? 0) * (b[1] ?? 0) +
          (a[2] ?? 0) * (b[2] ?? 0)
      )
    )
  ) / deg;

const seededRandom = (): (() => number) => {
  let s = 20_261_019;
  return (): number => {
    s = (s * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return s / 4_294_967_296;
  };
};

const stamp = (
  lat0: number,
  lon0: number,
  reach: number,
  each: (index: number, distance: number) => void
): void => {
  const center = unit(lat0, lon0);
  const lat1 = Math.max(-89.9, lat0 - reach);
  const lat2 = Math.min(89.9, lat0 + reach);
  const j1 = Math.floor(((lat1 + 90) / 180) * moonMapHeight);
  const j2 = Math.ceil(((lat2 + 90) / 180) * moonMapHeight);
  for (let j = Math.max(0, j1); j < Math.min(moonMapHeight, j2); j++) {
    const lat = ((j + 0.5) / moonMapHeight) * 180 - 90;
    const span = Math.min(180, reach / Math.max(0.05, Math.cos(lat * deg)));
    const i1 = Math.floor(((lon0 - span + 180) / 360) * moonMapWidth);
    const i2 = Math.ceil(((lon0 + span + 180) / 360) * moonMapWidth);
    for (let ii = i1; ii < i2; ii++) {
      const i = ((ii % moonMapWidth) + moonMapWidth) % moonMapWidth;
      const lon = ((i + 0.5) / moonMapWidth) * 360 - 180;
      const d = angle(center, unit(lat, lon));
      if (d <= reach) each(j * moonMapWidth + i, d);
    }
  }
};

export const moonMap = (): Uint8Array => {
  const rand = seededRandom();
  const size = moonMapWidth * moonMapHeight;
  const mareCenters = maria.map(([mlat, mlon]) => unit(mlat, mlon));
  const albedo = new Float32Array(size);
  const height = new Float32Array(size);
  const mare = new Float32Array(size);
  for (let j = 0; j < moonMapHeight; j++) {
    const lat = ((j + 0.5) / moonMapHeight) * 180 - 90;
    for (let i = 0; i < moonMapWidth; i++) {
      const lon = ((i + 0.5) / moonMapWidth) * 360 - 180;
      const p = unit(lat, lon);
      const at = j * moonMapWidth + i;
      const wobble =
        (fbm3(p[0] * 5, p[1] * 5, p[2] * 5, 3) - 0.5) * 1.1 +
        (fbm3(p[0] * 15 + 2, p[1] * 15, p[2] * 15, 3) - 0.5) * 0.45;
      let m = 0;
      for (const [k, entry] of maria.entries()) {
        const c = mareCenters[k];
        if (!entry || !c) continue;
        const radius = entry[2];
        const depth = entry[3];
        const cosD =
          p[0] * (c[0] ?? 0) + p[1] * (c[1] ?? 0) + p[2] * (c[2] ?? 0);
        if (cosD < Math.cos(Math.min(89, radius * 2.6) * deg)) continue;
        const d = Math.acos(Math.min(1, cosD)) / deg;
        const edge = radius * 1.28 * (1 + wobble);
        const t =
          1 - Math.min(1, Math.max(0, (d - edge * 0.82) / (edge * 0.36)));
        m = Math.max(m, smoothRamp(t) * depth);
      }
      mare[at] = Math.min(1.15, m);
      const high =
        0.74 +
        0.2 * (fbm3(p[0] * 3, p[1] * 3, p[2] * 3, 4) - 0.5) +
        0.12 * (fbm3(p[0] * 13, p[1] * 13, p[2] * 13, 3) - 0.5);
      const sea =
        0.4 +
        0.16 * (fbm3(p[0] * 6 + 4, p[1] * 6, p[2] * 6, 4) - 0.5) +
        0.05 * (fbm3(p[0] * 22, p[1] * 22, p[2] * 22, 2) - 0.5);
      albedo[at] = high + (sea - high) * Math.min(1, m);
      height[at] = -0.25 * Math.min(1, m);
    }
  }
  const addCrater = (
    lat: number,
    lon: number,
    radius: number,
    fresh: number,
    tone: number
  ): void => {
    const depth = 0.55 * Math.pow(radius, 0.75);
    stamp(lat, lon, radius * 2.4, (at, d) => {
      const x = d / radius;
      const bowl = x < 1 ? (x * x - 1) * depth : 0;
      const rim = 0.38 * depth * Math.exp(-(((x - 1) / 0.22) ** 2));
      const peak =
        radius > 1.6 ? 0.3 * depth * Math.exp(-((x / 0.16) ** 2)) : 0;
      const blanket = x > 1 ? 0.12 * depth * Math.exp(-(x - 1) * 2.2) : 0;
      height[at] = (height[at] ?? 0) + bowl + rim + peak + blanket;
      const ring = Math.exp(-(((x - 1) / 0.18) ** 2));
      const floor = x < 0.85 ? -0.05 : 0;
      const halo = x < 2 ? tone * Math.exp(-x * 1.6) : 0;
      albedo[at] =
        (albedo[at] ?? 0) +
        ring * (0.012 + 0.05 * fresh) +
        floor * 0.3 * (1 - fresh) +
        halo;
    });
  };
  for (let n = 0; n < 1400; n++) {
    const u = rand();
    const radius = 0.7 / Math.sqrt(1 - u * 0.97);
    if (radius > 7) continue;
    const z = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    const lat = Math.asin(z) / deg;
    const lon = ((Math.atan2(Math.sin(phi), Math.cos(phi)) / deg) * 0.62) % 180;
    const at =
      Math.floor(((lat + 90) / 180) * moonMapHeight) * moonMapWidth +
      Math.floor(((lon + 180) / 360) * moonMapWidth);
    const inMare = mare[at] ?? 0;
    if (inMare > 0.5 && rand() < 0.78) continue;
    addCrater(
      lat,
      lon,
      radius,
      rand() < 0.08 ? 1 : 0,
      rand() < 0.05 ? 0.06 : 0
    );
  }
  for (const [lat, lon, km, , tone] of craters) {
    const radius = km / 2 / moonKm / deg;
    addCrater(lat, lon, radius, tone > 0 ? 1 : 0, tone * 0.6);
  }
  for (const [lat, lon, km, rays, tone] of craters) {
    if (rays <= 0) continue;
    const radius = km / 2 / moonKm / deg;
    const count = Math.round(14 + rays * 0.9);
    for (let k = 0; k < count; k++) {
      const bearing = rand() * Math.PI * 2;
      const length = rays * (0.35 + 0.65 * rand());
      const width = radius * (0.25 + 0.45 * rand()) + 0.35;
      const power = tone * (0.35 + 0.65 * rand()) * 0.55;
      const center = unit(lat, lon);
      const north = [
        -Math.sin(lat * deg) * Math.sin(lon * deg),
        Math.cos(lat * deg),
        -Math.sin(lat * deg) * Math.cos(lon * deg),
      ];
      const east = [Math.cos(lon * deg), 0, -Math.sin(lon * deg)];
      const dir = [0, 1, 2].map(
        (c) =>
          Math.cos(bearing) * (north[c] ?? 0) +
          Math.sin(bearing) * (east[c] ?? 0)
      );
      for (let s = radius * 1.2; s < length; s += 0.6) {
        const a = s * deg;
        const q = [0, 1, 2].map(
          (c) => Math.cos(a) * (center[c] ?? 0) + Math.sin(a) * (dir[c] ?? 0)
        );
        const qlat = Math.asin(Math.min(1, Math.max(-1, q[1] ?? 0))) / deg;
        const qlon = Math.atan2(q[0] ?? 0, q[2] ?? 0) / deg;
        const fade = Math.pow(1 - s / length, 1.4) * power;
        stamp(qlat, qlon, width, (at, d) => {
          albedo[at] =
            (albedo[at] ?? 0) +
            fade * Math.exp(-((d / (width * 0.55)) ** 2)) * 0.5;
        });
      }
    }
  }
  const pixels = new Uint8Array(size * 4);
  for (let at = 0; at < size; at++) {
    pixels[at * 4] = Math.round(
      Math.min(1, Math.max(0, (albedo[at] ?? 0) * 0.92)) * 255
    );
    pixels[at * 4 + 1] = Math.round(
      Math.min(1, Math.max(0, 0.5 + (height[at] ?? 0) * 0.18)) * 255
    );
    pixels[at * 4 + 2] = Math.round(Math.min(1, mare[at] ?? 0) * 255);
    pixels[at * 4 + 3] = 255;
  }
  return pixels;
};

export const stackMap = (rgba: Uint8Array): Uint8Array => {
  const size = moonMapWidth * moonMapHeight;
  const gray = new Uint8Array(size * 2);
  for (let at = 0; at < size; at++) {
    gray[at] = rgba[at * 4] ?? 0;
    gray[size + at] = rgba[at * 4 + 1] ?? 0;
  }
  return gray;
};
