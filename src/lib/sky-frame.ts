import { deg } from "./math.ts";
import { nutation, siderealDeg } from "./sky-ephemeris.ts";

export type Mat3 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

const msPerDay = 86_400_000;
const julianUnixEpoch = 2_440_587.5;
const j2000 = 2_451_545;
const deltaTSeconds = 69;
const poleRa = 192.85948;
const poleDec = 27.12825;
const poleLongitude = 122.93192;

const at = (m: Mat3, index: number): number => m[index] ?? 0;

const multiply = (a: Mat3, b: Mat3): Mat3 => {
  const cell = (row: number, column: number): number =>
    at(a, row * 3) * at(b, column) +
    at(a, row * 3 + 1) * at(b, 3 + column) +
    at(a, row * 3 + 2) * at(b, 6 + column);
  return [
    cell(0, 0),
    cell(0, 1),
    cell(0, 2),
    cell(1, 0),
    cell(1, 1),
    cell(1, 2),
    cell(2, 0),
    cell(2, 1),
    cell(2, 2),
  ];
};

const transpose = (m: Mat3): Mat3 => [
  m[0],
  m[3],
  m[6],
  m[1],
  m[4],
  m[7],
  m[2],
  m[5],
  m[8],
];

const rotateX = (angle: number): Mat3 => {
  const c = Math.cos(angle * deg);
  const s = Math.sin(angle * deg);
  return [1, 0, 0, 0, c, s, 0, -s, c];
};

const rotateY = (angle: number): Mat3 => {
  const c = Math.cos(angle * deg);
  const s = Math.sin(angle * deg);
  return [c, 0, -s, 0, 1, 0, s, 0, c];
};

const rotateZ = (angle: number): Mat3 => {
  const c = Math.cos(angle * deg);
  const s = Math.sin(angle * deg);
  return [c, s, 0, -s, c, 0, 0, 0, 1];
};

const precession = (t: number): Mat3 => {
  const zeta = (2306.2181 * t + 0.30188 * t * t + 0.017998 * t * t * t) / 3600;
  const z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t * t * t) / 3600;
  const theta = (2004.3109 * t - 0.42665 * t * t - 0.041833 * t * t * t) / 3600;
  return multiply(rotateZ(-z), multiply(rotateY(theta), rotateZ(-zeta)));
};

const nutationMatrix = (t: number): Mat3 => {
  const nut = nutation(t);
  return multiply(
    rotateX(-nut.trueObliquity),
    multiply(rotateZ(-nut.longitude), rotateX(nut.obliquity))
  );
};

const localFrame = (latitude: number): Mat3 => {
  const c = Math.cos(latitude * deg);
  const s = Math.sin(latitude * deg);
  return [0, 1, 0, c, 0, s, -s, 0, c];
};

const galactic = ((): Mat3 => {
  const c = Math.cos(poleDec * deg);
  const s = Math.sin(poleDec * deg);
  const cl = Math.cos(poleLongitude * deg);
  const sl = Math.sin(poleLongitude * deg);
  const fromPole: Mat3 = [-cl * s, sl, cl * c, -sl * s, -cl, sl * c, c, 0, s];
  return multiply(fromPole, rotateZ(poleRa));
})();

const equatorialRows = (
  instant: number,
  latitude: number,
  longitude: number
): Mat3 => {
  const t =
    (instant / msPerDay + julianUnixEpoch + deltaTSeconds / 86_400 - j2000) /
    36_525;
  const ofDate = multiply(nutationMatrix(t), precession(t));
  const hourFrame = multiply(rotateZ(siderealDeg(instant, longitude)), ofDate);
  return multiply(localFrame(latitude), hourFrame);
};

export const equatorialToWorld = (
  instant: number,
  latitude: number,
  longitude: number
): Mat3 => transpose(equatorialRows(instant, latitude, longitude));

export const worldToGalactic = (
  instant: number,
  latitude: number,
  longitude: number
): Mat3 => {
  const toEquatorial = transpose(equatorialRows(instant, latitude, longitude));
  return transpose(multiply(galactic, toEquatorial));
};
