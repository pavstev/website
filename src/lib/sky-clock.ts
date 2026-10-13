import { clamp, clamp01, deg, smoothstep } from "./math.ts";

const msPerDay = 86_400_000;
const horizonDeg = -0.833;
const defaultTwilightHours = 1.1;

export interface SkyPhase {
  day: number;
  dusk: number;
  twilight: number;
}

export interface SunTimes {
  rise: number;
  set: number;
}

export const nightPhase: SkyPhase = { day: 0, dusk: 0, twilight: 0 };

const bell = (value: number): number => Math.exp(-(value * value));

export const sunTimes = (
  dayOfYear: number,
  latitude: number,
  noonHour: number
): SunTimes => {
  const declination =
    23.44 * deg * Math.sin((2 * Math.PI * (284 + dayOfYear)) / 365);
  const lat = latitude * deg;
  const cosHour =
    (Math.sin(horizonDeg * deg) - Math.sin(lat) * Math.sin(declination)) /
    (Math.cos(lat) * Math.cos(declination));
  const halfDay = Math.acos(clamp(cosHour, -1, 1)) / deg / 15;
  return { rise: noonHour - halfDay, set: noonHour + halfDay };
};

export const phaseAt = (
  hour: number,
  sun: SunTimes,
  twilightHours: number
): SkyPhase => {
  const edge = twilightHours * 0.5;
  const up =
    smoothstep(sun.rise - edge, sun.rise + edge, hour) *
    (1 - smoothstep(sun.set - edge, sun.set + edge, hour));
  const arc = Math.sin(
    clamp01((hour - sun.rise) / Math.max(sun.set - sun.rise, 0.001)) * Math.PI
  );
  const width = twilightHours * 0.6;
  return {
    day: up * (0.55 + 0.45 * arc),
    dusk: Math.abs(hour - sun.set) < Math.abs(hour - sun.rise) ? 1 : 0,
    twilight: clamp01(
      bell((hour - sun.rise) / width) + bell((hour - sun.set) / width)
    ),
  };
};

const viennaZone = "Europe/Vienna";
const viennaLatitude = 48.21;
const viennaStandardHours = 1;
const msPerHour = 3_600_000;

const viennaClock = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  hour: "numeric",
  hourCycle: "h23",
  minute: "numeric",
  month: "numeric",
  second: "numeric",
  timeZone: viennaZone,
  year: "numeric",
});

const viennaParts = (date: Date): Record<string, number> =>
  Object.fromEntries(
    viennaClock
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );

export const skyPhase = (
  date: Date,
  twilightHours = defaultTwilightHours
): SkyPhase => {
  const parts = viennaParts(date);
  const year = parts["year"] ?? date.getUTCFullYear();
  const month = (parts["month"] ?? 1) - 1;
  const day = parts["day"] ?? 1;
  const hours = parts["hour"] ?? 0;
  const minutes = parts["minute"] ?? 0;
  const seconds = parts["second"] ?? 0;
  const wall = Date.UTC(year, month, day, hours, minutes, seconds);
  const offset = Math.round((wall - date.getTime()) / msPerHour);
  const dayOfYear = Math.round(
    (Date.UTC(year, month, day) - Date.UTC(year, 0, 0)) / msPerDay
  );
  const sun = sunTimes(
    dayOfYear,
    viennaLatitude,
    12 + offset - viennaStandardHours
  );
  return phaseAt(hours + minutes / 60 + seconds / 3600, sun, twilightHours);
};

export const skyPhaseNames = ["night", "dawn", "day", "dusk"] as const;

export type SkyPhaseName = (typeof skyPhaseNames)[number];

const presetDayOfYear = 286;
const presetSummerHours = 2;
const presetNoonHour = 12 + presetSummerHours - viennaStandardHours;
const presetAfterSunHours = 20 / 60;
const presetSun = sunTimes(presetDayOfYear, viennaLatitude, presetNoonHour);

const namedPhases: Readonly<Record<SkyPhaseName, SkyPhase>> = {
  dawn: phaseAt(
    presetSun.rise + presetAfterSunHours,
    presetSun,
    defaultTwilightHours
  ),
  day: { day: 1, dusk: 0, twilight: 0 },
  dusk: phaseAt(
    presetSun.set + presetAfterSunHours,
    presetSun,
    defaultTwilightHours
  ),
  night: nightPhase,
};

export const phaseFromName = (name: SkyPhaseName): SkyPhase => ({
  ...namedPhases[name],
});
