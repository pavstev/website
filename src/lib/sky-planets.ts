import { deg } from "./math.ts";

export type PlanetName = "jupiter" | "mars" | "mercury" | "saturn" | "venus";

export interface PlanetSight {
  color: readonly [number, number, number];
  direction: readonly [number, number, number];
  magnitude: number;
  name: PlanetName;
}

type Elements = readonly [number, number, number, number, number, number];

interface Orbit {
  base: Elements;
  rate: Elements;
}

type Vector = readonly [number, number, number];

const msPerDay = 86_400_000;
const julianUnixEpoch = 2_440_587.5;
const j2000 = 2_451_545;
const deltaTSeconds = 69;
const daysPerCentury = 36_525;
const lightDaysPerAu = 0.0057755183;
const obliquity = 23.43928 * deg;
const keplerToleranceDeg = 1e-8;
const keplerSteps = 30;

const earth: Orbit = {
  base: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0],
  rate: [0.00000562, -0.00004392, -0.01294668, 35_999.37244981, 0.32327364, 0],
};

const orbits: Readonly<Record<PlanetName, Orbit>> = {
  jupiter: {
    base: [
      5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909,
    ],
    rate: [
      -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668,
      0.20469106,
    ],
  },
  mars: {
    base: [
      1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891,
    ],
    rate: [
      0.00001847, 0.00007882, -0.00813131, 19_140.30268499, 0.44441088,
      -0.29257343,
    ],
  },
  mercury: {
    base: [
      0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593,
    ],
    rate: [
      0.00000037, 0.00001906, -0.00594749, 149_472.67411175, 0.16047689,
      -0.12534081,
    ],
  },
  saturn: {
    base: [
      9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831,
      113.66242448,
    ],
    rate: [
      -0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216,
      -0.28867794,
    ],
  },
  venus: {
    base: [
      0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718,
      76.67984255,
    ],
    rate: [
      0.0000039, -0.00004107, -0.0007889, 58_517.81538729, 0.00268329,
      -0.27769418,
    ],
  },
};

const colors: Readonly<Record<PlanetName, readonly [number, number, number]>> =
  {
    jupiter: [1, 0.9, 0.72],
    mars: [1, 0.42, 0.2],
    mercury: [1, 0.92, 0.84],
    saturn: [1, 0.84, 0.52],
    venus: [1, 0.96, 0.88],
  };

const names: readonly PlanetName[] = [
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
];

const ringPoleRa = 40.589 * deg;
const ringPoleDec = 83.537 * deg;
const ringPole: Vector = [
  Math.cos(ringPoleDec) * Math.cos(ringPoleRa),
  Math.cos(ringPoleDec) * Math.sin(ringPoleRa),
  Math.sin(ringPoleDec),
];

const centuriesAt = (instant: number): number =>
  ((instant + deltaTSeconds * 1000) / msPerDay + julianUnixEpoch - j2000) /
  daysPerCentury;

const wrapDegrees = (angle: number): number =>
  angle - 360 * Math.floor((angle + 180) / 360);

const eccentricAnomaly = (meanDeg: number, eccentricity: number): number => {
  const eStar = eccentricity / deg;
  let anomaly = meanDeg + eStar * Math.sin(meanDeg * deg);
  for (let step = 0; step < keplerSteps; step += 1) {
    const meanError = meanDeg - (anomaly - eStar * Math.sin(anomaly * deg));
    const delta = meanError / (1 - eccentricity * Math.cos(anomaly * deg));
    anomaly += delta;
    if (Math.abs(delta) <= keplerToleranceDeg) break;
  }
  return anomaly;
};

const heliocentric = (orbit: Orbit, centuries: number): Vector => {
  const at = (index: 0 | 1 | 2 | 3 | 4 | 5): number =>
    orbit.base[index] + orbit.rate[index] * centuries;
  const semiMajor = at(0);
  const eccentricity = at(1);
  const inclination = at(2) * deg;
  const perihelion = at(4);
  const node = at(5);
  const argument = (perihelion - node) * deg;
  const mean = wrapDegrees(at(3) - perihelion);
  const anomaly = eccentricAnomaly(mean, eccentricity) * deg;
  const xOrbit = semiMajor * (Math.cos(anomaly) - eccentricity);
  const yOrbit =
    semiMajor * Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(anomaly);
  const cosW = Math.cos(argument);
  const sinW = Math.sin(argument);
  const cosN = Math.cos(node * deg);
  const sinN = Math.sin(node * deg);
  const cosI = Math.cos(inclination);
  const sinI = Math.sin(inclination);
  const x =
    (cosW * cosN - sinW * sinN * cosI) * xOrbit +
    (-sinW * cosN - cosW * sinN * cosI) * yOrbit;
  const y =
    (cosW * sinN + sinW * cosN * cosI) * xOrbit +
    (-sinW * sinN + cosW * cosN * cosI) * yOrbit;
  const z = sinW * sinI * xOrbit + cosW * sinI * yOrbit;
  return [
    x,
    y * Math.cos(obliquity) - z * Math.sin(obliquity),
    y * Math.sin(obliquity) + z * Math.cos(obliquity),
  ];
};

const subtract = (a: Vector, b: Vector): Vector => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];

const dot = (a: Vector, b: Vector): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const length = (a: Vector): number => Math.sqrt(dot(a, a));

const unit = (a: Vector): Vector => {
  const size = length(a);
  return [a[0] / size, a[1] / size, a[2] / size];
};

const ringLatitude = (toward: Vector): number =>
  Math.asin(dot(ringPole, unit(toward)));

const saturnRings = (
  fromSun: Vector,
  toEarth: Vector,
  phase: number
): number => {
  const earthSide = ringLatitude(toEarth);
  const sunSide = ringLatitude([-fromSun[0], -fromSun[1], -fromSun[2]]);
  const tilt = earthSide * sunSide > 0 ? Math.sqrt(earthSide * sunSide) : 0;
  const sinTilt = Math.sin(tilt);
  return (
    -8.914 -
    1.825 * sinTilt +
    0.026 * phase -
    0.378 * sinTilt * Math.exp(-2.25 * phase)
  );
};

const phaseCurve = (
  name: PlanetName,
  phase: number,
  fromSun: Vector,
  toEarth: Vector
): number => {
  switch (name) {
    case "jupiter": {
      if (phase <= 12) return -9.395 - 3.7e-4 * phase + 6.16e-4 * phase ** 2;
      const x = phase / 180;
      return (
        -9.428 -
        2.5 *
          Math.log10(
            1 -
              1.507 * x -
              0.363 * x ** 2 -
              0.062 * x ** 3 +
              2.809 * x ** 4 -
              1.876 * x ** 5
          )
      );
    }
    case "mars": {
      return phase <= 50
        ? -1.601 + 0.02267 * phase - 0.0001302 * phase ** 2
        : -0.367 - 0.02573 * phase + 0.0003445 * phase ** 2;
    }
    case "mercury": {
      return (
        -0.613 +
        6.328e-2 * phase -
        1.6336e-3 * phase ** 2 +
        3.3644e-5 * phase ** 3 -
        3.4265e-7 * phase ** 4 +
        1.6893e-9 * phase ** 5 -
        3.0334e-12 * phase ** 6
      );
    }
    case "saturn": {
      return phase < 6.5
        ? saturnRings(fromSun, toEarth, phase)
        : -8.94 +
            2.446e-4 * phase +
            2.672e-4 * phase ** 2 -
            1.505e-6 * phase ** 3 +
            4.767e-9 * phase ** 4;
    }
    case "venus": {
      return phase <= 163.7
        ? -4.384 -
            1.044e-3 * phase +
            3.687e-4 * phase ** 2 -
            2.814e-6 * phase ** 3 +
            8.938e-9 * phase ** 4
        : 236.05828 - 2.81914 * phase + 8.39034e-3 * phase ** 2;
    }
  }
};

const sight = (
  name: PlanetName,
  centuries: number,
  earthAt: Vector
): PlanetSight => {
  const orbit = orbits[name];
  const first = heliocentric(orbit, centuries);
  const lightCenturies =
    (length(subtract(first, earthAt)) * lightDaysPerAu) / daysPerCentury;
  const fromSun = heliocentric(orbit, centuries - lightCenturies);
  const toPlanet = subtract(fromSun, earthAt);
  const distance = length(toPlanet);
  const sunDistance = length(fromSun);
  const cosPhase = dot(fromSun, toPlanet) / (sunDistance * distance);
  const phase = Math.acos(Math.max(-1, Math.min(1, cosPhase))) / deg;
  const toEarth: Vector = [-toPlanet[0], -toPlanet[1], -toPlanet[2]];
  return {
    color: colors[name],
    direction: unit(toPlanet),
    magnitude:
      5 * Math.log10(sunDistance * distance) +
      phaseCurve(name, phase, fromSun, toEarth),
    name,
  };
};

export const planetsAt = (instant: number): PlanetSight[] => {
  const centuries = centuriesAt(instant);
  const earthAt = heliocentric(earth, centuries);
  return names.map((name) => sight(name, centuries, earthAt));
};
