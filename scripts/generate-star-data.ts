import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

interface Star {
  bv: number;
  dec: number;
  ra: number;
  vmag: number;
}

type Vector = [number, number, number];

const root = process.cwd();
const years = 26;
const missingBv = 0.6;
const bytesPerStar = 6;
const deg = Math.PI / 180;

const field = (line: string, from: number, to: number): string =>
  line.slice(from - 1, to).trim();

const number = (line: string, from: number, to: number): null | number => {
  const text = field(line, from, to);
  return text === "" ? null : Number(text);
};

const moved = (
  ra: number,
  dec: number,
  pmRa: number,
  pmDec: number
): { dec: number; ra: number } => {
  const a = ra * deg;
  const d = dec * deg;
  const east: Vector = [-Math.sin(a), Math.cos(a), 0];
  const north: Vector = [
    -Math.sin(d) * Math.cos(a),
    -Math.sin(d) * Math.sin(a),
    Math.cos(d),
  ];
  const shiftEast = ((pmRa * years) / 3600) * deg;
  const shiftNorth = ((pmDec * years) / 3600) * deg;
  const x =
    Math.cos(d) * Math.cos(a) + east[0] * shiftEast + north[0] * shiftNorth;
  const y =
    Math.cos(d) * Math.sin(a) + east[1] * shiftEast + north[1] * shiftNorth;
  const z = Math.sin(d) + north[2] * shiftNorth;
  const length = Math.hypot(x, y, z);
  return {
    dec: Math.asin(z / length) / deg,
    ra: (((Math.atan2(y, x) / deg) % 360) + 360) % 360,
  };
};

const parse = (line: string): null | Star => {
  const hours = number(line, 76, 77);
  const vmag = number(line, 103, 107);
  if (hours === null || vmag === null) return null;
  const ra =
    (hours +
      (number(line, 78, 79) ?? 0) / 60 +
      (number(line, 80, 83) ?? 0) / 3600) *
    15;
  const sign = field(line, 84, 84) === "-" ? -1 : 1;
  const dec =
    sign *
    ((number(line, 85, 86) ?? 0) +
      (number(line, 87, 88) ?? 0) / 60 +
      (number(line, 89, 90) ?? 0) / 3600);
  const place = moved(
    ra,
    dec,
    number(line, 149, 154) ?? 0,
    number(line, 155, 160) ?? 0
  );
  return { bv: number(line, 110, 114) ?? missingBv, vmag, ...place };
};

const byte = (value: number): number =>
  Math.min(255, Math.max(0, Math.round(value)));

const pack = (stars: Star[]): Buffer => {
  const buffer = Buffer.alloc(stars.length * bytesPerStar);
  for (const [index, star] of stars.entries()) {
    const offset = index * bytesPerStar;
    buffer.writeUInt16LE(Math.round((star.ra / 360) * 65_536) % 65_536, offset);
    buffer.writeInt16LE(Math.round((star.dec / 90) * 32_767), offset + 2);
    buffer.writeUInt8(byte((star.vmag + 2) * 20), offset + 4);
    buffer.writeUInt8(byte((star.bv + 0.5) * 100), offset + 5);
  }
  return buffer;
};

const source = process.argv[2];
if (!source) throw new Error("usage: generate-star-data.ts <catalog.gz>");

const stars = gunzipSync(readFileSync(source))
  .toString("latin1")
  .split("\n")
  .map((line) => parse(line))
  .filter((star): star is Star => star !== null)
  .toSorted((a, b) => a.vmag - b.vmag);

const output = `export const starCount = ${String(stars.length)};

export const starData =
  "${pack(stars).toString("base64")}";
`;

writeFileSync(path.join(root, "src/lib/star-data.ts"), output);
process.stdout.write(`${String(stars.length)} stars\n`);
