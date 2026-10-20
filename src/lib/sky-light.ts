import { paintPalettes } from "./sky-palette.ts";
import { horizonHeight, pixelsPerDegree, type ViewSize } from "./sky-view.ts";
import { hexBytes } from "./theme.ts";

export interface ScatterOutput {
  ambient: Vec3;
  ambientLinear: Vec3;
  bright: number;
  cloudLight: Vec3;
  cloudSun: Vec3;
  cloudSunPower: number;
  pixels: Uint8Array;
  scale: number;
  sunColor: Vec3;
}

export interface SkyTable {
  lit: readonly [number, number, number];
  low: readonly [number, number, number];
  mid: readonly [number, number, number];
  pixels: Uint8Array;
  shade: readonly [number, number, number];
  sunColor: readonly [number, number, number];
  top: readonly [number, number, number];
}

export interface TableInput {
  center: number;
  haze: number;
  moon: { altitude: number; azimuth: number; fraction: number };
  sun: { altitude: number; azimuth: number };
  view: ViewSize;
}

interface ScatterInput {
  adapt: number;
  blueHour?: number;
  cols: number;
  haze: number;
  moon: SkyLight;
  multi?: number;
  night: { low: Vec3; mid: Vec3; top: Vec3 };
  rows: number;
  sun: SkyLight;
  view: ScatterView;
}

interface ScatterView {
  center: number;
  height: number;
  horizon: number;
  ppd: number;
  width: number;
}

interface SkyLight {
  altitude: number;
  azimuth: number;
  power: number;
}

type Vec3 = [number, number, number];

export const lutCols = 40;
export const lutRows = 24;

const planet = 6360;
const atmosphereTop = 6460;
const eye = 0.25;
const cloudKm = 2.5;
const rayleigh: Vec3 = [5.802e-3, 13.558e-3, 33.1e-3];
const ozone: Vec3 = [0.65e-3, 1.881e-3, 0.085e-3];
const mieScatter = 3.996e-3;
const mieExtinct = 4.44e-3;
const rayleighKm = 8;
const mieKm = 1.2;
const deg = Math.PI / 180;
const tableH = 48;
const tableMu = 256;
const shadowDepth = 60;

const dot = (a: Vec3, b: Vec3): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const direction = (altitude: number, azimuth: number): Vec3 => {
  const a = altitude * deg;
  const z = azimuth * deg;
  return [Math.cos(a) * Math.sin(z), Math.sin(a), Math.cos(a) * Math.cos(z)];
};

const cell = (v: Vec3, i: number): number => v[i] ?? 0;

const exitSphere = (p: Vec3, d: Vec3): number => {
  const b = dot(p, d);
  const c = dot(p, p) - atmosphereTop * atmosphereTop;
  const disc = b * b - c;
  return disc < 0 ? -1 : -b + Math.sqrt(disc);
};

const hitsGround = (p: Vec3, d: Vec3): boolean => {
  const b = dot(p, d);
  if (b > 0) return false;
  const c = dot(p, p) - planet * planet;
  return b * b > c;
};

const densityInto = (h: number, out: Vec3): void => {
  out[0] = Math.exp(-h / rayleighKm);
  out[1] = Math.exp(-h / mieKm);
  out[2] = Math.max(0, 1 - Math.abs(h - 25) / 15);
};

const heightAt = (i: number): number => 100 * (i / (tableH - 1)) ** 2;

const muAt = (j: number): number => {
  const x = -1 + (2 * j) / (tableMu - 1);
  return Math.sign(x) * x * x;
};

const scratch = {
  depth: [0, 0, 0] as Vec3,
  ext: [0, 0, 0] as Vec3,
  eye: [0, planet + eye, 0] as Vec3,
  point: [0, 0, 0] as Vec3,
  rho: [0, 0, 0] as Vec3,
  tau: [0, 0, 0] as Vec3,
};

let integralCache: Float64Array | null = null;

const integrals = (): Float64Array => {
  if (integralCache) return integralCache;
  const table = new Float64Array(tableH * tableMu * 3);
  const { rho } = scratch;
  const q = scratch.point;
  for (let i = 0; i < tableH; i++) {
    const p: Vec3 = [0, planet + heightAt(i), 0];
    for (let j = 0; j < tableMu; j++) {
      const mu = muAt(j);
      const d: Vec3 = [Math.sqrt(Math.max(0, 1 - mu * mu)), mu, 0];
      const at = (i * tableMu + j) * 3;
      if (hitsGround(p, d)) {
        table[at] = -1;
        continue;
      }
      const len = exitSphere(p, d);
      const steps = 40;
      let r = 0;
      let m = 0;
      let o = 0;
      for (let k = 0; k < steps; k++) {
        const t = (len * (k + 0.5)) / steps;
        q[0] = p[0] + d[0] * t;
        q[1] = p[1] + d[1] * t;
        q[2] = p[2] + d[2] * t;
        densityInto(Math.sqrt(dot(q, q)) - planet, rho);
        r += rho[0];
        m += rho[1];
        o += rho[2];
      }
      const dt = len / steps;
      table[at] = r * dt;
      table[at + 1] = m * dt;
      table[at + 2] = o * dt;
    }
  }
  integralCache = table;
  return table;
};

let lastDepth: null | { haze: number; table: Float32Array } = null;

const depthTable = (haze: number): Float32Array => {
  if (lastDepth?.haze === haze) return lastDepth.table;
  const base = integrals();
  const table = new Float32Array(tableH * tableMu * 3);
  for (let at = 0; at < table.length; at += 3) {
    const r = base[at] ?? 0;
    if (r < 0) {
      table[at] = shadowDepth;
      table[at + 1] = shadowDepth;
      table[at + 2] = shadowDepth;
      continue;
    }
    const m = base[at + 1] ?? 0;
    const o = base[at + 2] ?? 0;
    for (let c = 0; c < 3; c++)
      table[at + c] =
        cell(rayleigh, c) * r + mieExtinct * haze * m + cell(ozone, c) * o;
  }
  lastDepth = { haze, table };
  return table;
};

const lookup = (
  table: Float32Array,
  h: number,
  mu: number,
  out: Vec3
): void => {
  const fi = Math.sqrt(Math.min(Math.max(h, 0), 100) / 100) * (tableH - 1);
  const x = Math.sign(mu) * Math.sqrt(Math.abs(mu));
  const fj = ((x + 1) / 2) * (tableMu - 1);
  const i0 = Math.min(tableH - 2, Math.floor(fi));
  const j0 = Math.min(tableMu - 2, Math.max(0, Math.floor(fj)));
  const ti = fi - i0;
  const tj = Math.min(1, Math.max(0, fj - j0));
  for (let c = 0; c < 3; c++) {
    const a = table[(i0 * tableMu + j0) * 3 + c] ?? 0;
    const b = table[(i0 * tableMu + j0 + 1) * 3 + c] ?? 0;
    const e = table[((i0 + 1) * tableMu + j0) * 3 + c] ?? 0;
    const f = table[((i0 + 1) * tableMu + j0 + 1) * 3 + c] ?? 0;
    out[c] = (a + (b - a) * tj) * (1 - ti) + (e + (f - e) * tj) * ti;
  }
};

const phaseRayleigh = (mu: number): number =>
  (3 / (16 * Math.PI)) * (1 + mu * mu);

const phaseMie = (mu: number): number => {
  const g = 0.8;
  const g2 = g * g;
  return (
    ((3 / (8 * Math.PI)) * ((1 - g2) * (1 + mu * mu))) /
    ((2 + g2) * (1 + g2 - 2 * g * mu) ** 1.5)
  );
};

const luma = (c: Vec3): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

const radiance = (
  table: Float32Array,
  haze: number,
  v: Vec3,
  lights: ReadonlyArray<{ dir: Vec3; power: number }>,
  out: Vec3
): void => {
  const { depth, ext, point: p, rho, tau } = scratch;
  const o = scratch.eye;
  const len = exitSphere(o, v);
  const steps = 28;
  tau[0] = 0;
  tau[1] = 0;
  tau[2] = 0;
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  for (let k = 0; k < steps; k++) {
    const u = (k + 0.5) / steps;
    const t = len * u * u;
    const dt = (len * 2 * u) / steps;
    p[0] = o[0] + v[0] * t;
    p[1] = o[1] + v[1] * t;
    p[2] = o[2] + v[2] * t;
    const r = Math.sqrt(dot(p, p));
    const h = r - planet;
    densityInto(h, rho);
    for (let c = 0; c < 3; c++)
      ext[c] =
        cell(rayleigh, c) * rho[0] +
        mieExtinct * haze * rho[1] +
        cell(ozone, c) * rho[2];
    for (const light of lights) {
      if (light.power <= 0) continue;
      const mu = dot(p, light.dir) / r;
      lookup(table, h, mu, depth);
      if (depth[1] >= shadowDepth * 0.98) continue;
      const cosTheta = dot(v, light.dir);
      const pr = phaseRayleigh(cosTheta);
      const pm = phaseMie(cosTheta);
      for (let c = 0; c < 3; c++) {
        const scatter =
          cell(rayleigh, c) * rho[0] * pr + mieScatter * haze * rho[1] * pm;
        const along = cell(tau, c) + cell(ext, c) * dt * 0.5 + cell(depth, c);
        out[c] = cell(out, c) + scatter * Math.exp(-along) * dt * light.power;
      }
    }
    for (let c = 0; c < 3; c++) tau[c] = cell(tau, c) + cell(ext, c) * dt;
  }
};

const computeNoonLevel = (): number => {
  const table = depthTable(1);
  const sun = direction(45, 0);
  const out: Vec3 = [0, 0, 0];
  let sum = 0;
  let n = 0;
  for (let alt = 15; alt <= 60; alt += 15)
    for (let az = 60; az <= 300; az += 40) {
      radiance(table, 1, direction(alt, az), [{ dir: sun, power: 1 }], out);
      sum += luma(out);
      n++;
    }
  return sum / n;
};

let noonCache = 0;

const noonLevel = (): number => {
  if (noonCache === 0) noonCache = computeNoonLevel();
  return noonCache;
};

const toLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

const linear = (c: Vec3): Vec3 => [
  toLinear(c[0]),
  toLinear(c[1]),
  toLinear(c[2]),
];

const encode = (v: number): number =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;

const display = (c: Vec3): Vec3 => {
  const l = luma(c);
  if (l <= 0) return [0, 0, 0];
  const mapped = l < 0.6 ? l : 0.6 + 0.4 * (1 - Math.exp(-(l - 0.6) / 0.4));
  const k = mapped / l;
  let r = Math.max(0, c[0] * k);
  let g = Math.max(0, c[1] * k);
  let b = Math.max(0, c[2] * k);
  const peak = Math.max(r, g, b);
  if (peak > 1) {
    const white = Math.min(1, (peak - 1) * 0.25);
    r = r / peak + (1 - r / peak) * white;
    g = g / peak + (1 - g / peak) * white;
    b = b / peak + (1 - b / peak) * white;
  }
  return [
    encode(Math.min(1, r)),
    encode(Math.min(1, g)),
    encode(Math.min(1, b)),
  ];
};

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const warmSkyTable = (): void => {
  noonLevel();
};

export const scatterSky = (input: ScatterInput): ScatterOutput => {
  const { cols, haze, rows, view } = input;
  const noon = noonLevel();
  const table = depthTable(haze);
  const sunDir = direction(input.sun.altitude, input.sun.azimuth);
  const moonDir = direction(input.moon.altitude, input.moon.azimuth);
  const lights = [
    { dir: sunDir, power: input.sun.power },
    { dir: moonDir, power: input.moon.power },
  ];
  const raw = new Float32Array(cols * rows * 3);
  const out: Vec3 = [0, 0, 0];
  let refSum = 0;
  let refN = 0;
  const ambient: Vec3 = [0, 0, 0];
  let ambientN = 0;
  for (let r = 0; r < rows; r++) {
    const y = ((r + 0.5) / rows) * view.height;
    const altitude = (y - view.horizon) / view.ppd;
    for (let c = 0; c < cols; c++) {
      const x = ((c + 0.5) / cols) * view.width;
      const azimuth = view.center + (x - view.width / 2) / view.ppd;
      const v = direction(Math.max(altitude, 0.4), azimuth);
      radiance(table, haze, v, lights, out);
      const at = (r * cols + c) * 3;
      raw[at] = out[0];
      raw[at + 1] = out[1];
      raw[at + 2] = out[2];
      const cosSun = Math.min(1, Math.max(-1, dot(v, sunDir)));
      const fromSun = Math.acos(cosSun) / deg;
      if (altitude > 8 && altitude < 70 && fromSun > 25) {
        refSum += luma(out);
        refN++;
      }
      if (!(altitude > 5)) {
        continue;
      }

      ambient[0] += out[0];
      ambient[1] += out[1];
      ambient[2] += out[2];
      ambientN++;
    }
  }
  const multi = input.multi ?? 0;
  if (multi > 0 && ambientN > 0) {
    const dome: Vec3 = [0, 0, 0];
    let domeN = 0;
    for (const alt of [3, 12, 28, 50, 75])
      for (let az = 0; az < 360; az += 30) {
        radiance(table, haze, direction(alt, az), lights, out);
        dome[0] += out[0];
        dome[1] += out[1];
        dome[2] += out[2];
        domeN++;
      }
    const fill: Vec3 = [0, 0, 0];
    const rMax = rayleigh[2];
    for (let c = 0; c < 3; c++)
      fill[c] = (cell(dome, c) / domeN) * multi * (cell(rayleigh, c) / rMax);
    for (let i = 0; i < raw.length; i += 3) {
      raw[i] = (raw[i] ?? 0) + fill[0];
      raw[i + 1] = (raw[i + 1] ?? 0) + fill[1];
      raw[i + 2] = (raw[i + 2] ?? 0) + fill[2];
    }
    refSum += luma(fill) * refN;
    for (let c = 0; c < 3; c++)
      ambient[c] = cell(ambient, c) + cell(fill, c) * ambientN;
  }
  const ref = Math.max(refN > 0 ? refSum / refN : 0, noon * 1e-12);
  const bright = 0.3 * (ref / noon) ** input.adapt;
  const scale = bright / ref;
  const nightShare = 1 - smooth(-16, -5, input.sun.altitude);
  const lowN = linear(input.night.low);
  const midN = linear(input.night.mid);
  const topN = linear(input.night.top);
  const hour = smooth(1, -7, input.sun.altitude) * (input.blueHour ?? 0);
  const blue: Vec3 = [1 - 0.4 * hour, 1 - 0.14 * hour, 1 + 0.3 * hour];
  const pixels = new Uint8Array(cols * rows * 4);
  for (let r = 0; r < rows; r++) {
    const yb = (r + 0.5) / rows;
    const a = smooth(-0.05, 0.5, yb);
    const b = smooth(0.4, 1.05, yb);
    const base: Vec3 = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const lowC = cell(lowN, c);
      const low = lowC + (cell(midN, c) - lowC) * a;
      base[c] = (low + (cell(topN, c) - low) * b) * nightShare;
    }
    for (let c = 0; c < cols; c++) {
      const at = (r * cols + c) * 3;
      const lin: Vec3 = [
        (raw[at] ?? 0) * scale * blue[0] + base[0],
        (raw[at + 1] ?? 0) * scale * blue[1] + base[1],
        (raw[at + 2] ?? 0) * scale * blue[2] + base[2],
      ];
      const d = display(lin);
      const px = (r * cols + c) * 4;
      pixels[px] = Math.round(Math.min(1, d[0]) * 255);
      pixels[px + 1] = Math.round(Math.min(1, d[1]) * 255);
      pixels[px + 2] = Math.round(Math.min(1, d[2]) * 255);
      pixels[px + 3] = 255;
    }
  }
  const eyeDepth: Vec3 = [0, 0, 0];
  lookup(table, eye, Math.sin(input.sun.altitude * deg), eyeDepth);
  const sunT: Vec3 = [
    Math.exp(-eyeDepth[0]),
    Math.exp(-eyeDepth[1]),
    Math.exp(-eyeDepth[2]),
  ];
  const sunMax = Math.max(sunT[0], sunT[1], sunT[2], 1e-6);
  const cloudDepth: Vec3 = [0, 0, 0];
  const dip = Math.acos(planet / (planet + cloudKm)) / deg;
  lookup(table, cloudKm, Math.sin(input.sun.altitude * deg), cloudDepth);
  const cloudT: Vec3 = [
    Math.exp(-cloudDepth[0]),
    Math.exp(-cloudDepth[1]),
    Math.exp(-cloudDepth[2]),
  ];
  const cloudMax = Math.max(cloudT[0], cloudT[1], cloudT[2], 1e-9);
  const lit = input.sun.altitude > -dip ? 1 : 0;
  const n = Math.max(1, ambientN);
  const cloudSunPower =
    lit *
    Math.min(1, cloudMax * 1.6) *
    smooth(-dip - 0.6, -dip + 1.2, input.sun.altitude);
  const cloudLum = Math.min(0.85, 3 * noon * scale * cloudMax) * cloudSunPower;
  const ambientLinear: Vec3 = [
    (ambient[0] / n) * scale + topN[0] * nightShare,
    (ambient[1] / n) * scale + topN[1] * nightShare,
    (ambient[2] / n) * scale + topN[2] * nightShare,
  ];
  return {
    ambient: display(ambientLinear),
    ambientLinear,
    bright,
    cloudLight: [
      (cloudT[0] / cloudMax) * cloudLum,
      (cloudT[1] / cloudMax) * cloudLum,
      (cloudT[2] / cloudMax) * cloudLum,
    ],
    cloudSun: [
      cloudT[0] / cloudMax,
      cloudT[1] / cloudMax,
      cloudT[2] / cloudMax,
    ],
    cloudSunPower,
    pixels,
    scale,
    sunColor: display([sunT[0] / sunMax, sunT[1] / sunMax, sunT[2] / sunMax]),
  };
};

const unit = (hex: string): Vec3 => {
  const [r, g, b] = hexBytes(hex);
  return [r / 255, g / 255, b / 255];
};

const rowMean = (pixels: Uint8Array, yb: number): Vec3 => {
  const row = Math.min(lutRows - 1, Math.max(0, Math.floor(yb * lutRows)));
  const sum: Vec3 = [0, 0, 0];
  for (let c = 0; c < lutCols; c++) {
    const i = (row * lutCols + c) * 4;
    sum[0] += (pixels[i] ?? 0) / 255;
    sum[1] += (pixels[i + 1] ?? 0) / 255;
    sum[2] += (pixels[i + 2] ?? 0) / 255;
  }
  return [sum[0] / lutCols, sum[1] / lutCols, sum[2] / lutCols];
};

export const skyTable = (input: TableInput): SkyTable => {
  const { center, moon, sun, view } = input;
  const { height, width } = view;
  const { night } = paintPalettes;
  const haze = Number.isFinite(input.haze) ? Math.max(0, input.haze) : 1;
  const result = scatterSky({
    adapt: 0.28,
    blueHour: 1,
    cols: lutCols,
    haze: 1.2 * haze,
    moon: {
      altitude: moon.altitude,
      azimuth: moon.azimuth,
      power: 2.5e-6 * moon.fraction ** 1.5,
    },
    multi: 0.6,
    night: { low: unit(night.low), mid: unit(night.mid), top: unit(night.top) },
    rows: lutRows,
    sun: { altitude: sun.altitude, azimuth: sun.azimuth, power: 1 },
    view: {
      center,
      height,
      horizon: horizonHeight(height),
      ppd: pixelsPerDegree(height),
      width,
    },
  });
  const ambient = result.ambientLinear;
  const light = result.cloudLight;
  return {
    lit: display([
      ambient[0] * 0.7 + light[0],
      ambient[1] * 0.7 + light[1],
      ambient[2] * 0.7 + light[2],
    ]),
    low: rowMean(result.pixels, 0.05),
    mid: rowMean(result.pixels, 0.45),
    pixels: result.pixels,
    shade: display([ambient[0] * 0.45, ambient[1] * 0.45, ambient[2] * 0.45]),
    sunColor: result.sunColor,
    top: rowMean(result.pixels, 0.96),
  };
};

export const safeSkyTable = (input: TableInput): SkyTable | undefined => {
  try {
    const table = skyTable(input);
    const colors = [
      table.lit,
      table.low,
      table.mid,
      table.shade,
      table.sunColor,
      table.top,
    ];
    return colors.every((color) =>
      color.every((channel) => Number.isFinite(channel))
    )
      ? table
      : undefined;
  } catch {
    return undefined;
  }
};
