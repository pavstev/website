import { deg } from "./math.ts";
import { starCount, starData } from "./star-data.ts";

type Rgb = readonly [number, number, number];

const bytesPerStar = 6;
const floatsPerStar = 7;
const planckC2 = 1.4388e7;

const lobe = (x: number, mean: number, low: number, high: number): number => {
  const spread = (x - mean) / (x < mean ? low : high);
  return Math.exp(-0.5 * spread * spread);
};

export const starColor = (bv: number): Rgb => {
  const index = Math.min(2.05, Math.max(-0.5, bv));
  const kelvin = 4600 * (1 / (0.92 * index + 1.7) + 1 / (0.92 * index + 0.62));
  let x = 0;
  let y = 0;
  let z = 0;
  for (let nm = 380; nm <= 780; nm += 5) {
    const power = 1 / (nm ** 5 * Math.expm1(planckC2 / (nm * kelvin)));
    x +=
      power *
      (1.056 * lobe(nm, 599.8, 37.9, 31) +
        0.362 * lobe(nm, 442, 16, 26.7) -
        0.065 * lobe(nm, 501.1, 20.4, 26.2));
    y +=
      power *
      (0.821 * lobe(nm, 568.8, 46.9, 40.5) +
        0.286 * lobe(nm, 530.9, 16.3, 31.1));
    z +=
      power *
      (1.217 * lobe(nm, 437, 11.8, 36) + 0.681 * lobe(nm, 459, 26, 13.8));
  }
  const r = Math.max(0, 3.2406 * x - 1.5372 * y - 0.4986 * z);
  const g = Math.max(0, -0.9689 * x + 1.8758 * y + 0.0415 * z);
  const b = Math.max(0, 0.0557 * x - 0.204 * y + 1.057 * z);
  const peak = Math.max(r, g, b);
  return [r / peak, g / peak, b / peak];
};

export const decodeStars = (): Float32Array => {
  const binary = atob(starData);
  const view = new DataView(
    Uint8Array.from(binary, (char) => char.codePointAt(0) ?? 0).buffer
  );
  const out = new Float32Array(starCount * floatsPerStar);
  const colors = new Map<number, Rgb>();
  for (let index = 0; index < starCount; index += 1) {
    const offset = index * bytesPerStar;
    const ra = (view.getUint16(offset, true) / 65_536) * 360 * deg;
    const dec = (view.getInt16(offset + 2, true) / 32_767) * 90 * deg;
    const code = view.getUint8(offset + 5);
    const color = colors.get(code) ?? starColor(code / 100 - 0.5);
    colors.set(code, color);
    out.set(
      [
        Math.cos(dec) * Math.cos(ra),
        Math.cos(dec) * Math.sin(ra),
        Math.sin(dec),
        view.getUint8(offset + 4) / 20 - 2,
        ...color,
      ],
      index * floatsPerStar
    );
  }
  return out;
};
