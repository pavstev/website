const deg = Math.PI / 180;
const msPerDay = 86_400_000;
const horizonDeg = -0.833;
const defaultLatitude = 47;
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

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const smoothstep = (from: number, to: number, value: number): number => {
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};

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
  const halfDay = Math.acos(Math.min(1, Math.max(-1, cosHour))) / deg / 15;
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

const dayOfYear = (date: Date): number =>
  Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / msPerDay
  );

const summerTimeHours = (date: Date): number => {
  const year = date.getFullYear();
  const standard = Math.max(
    new Date(year, 0, 1).getTimezoneOffset(),
    new Date(year, 6, 1).getTimezoneOffset()
  );
  return (standard - date.getTimezoneOffset()) / 60;
};

export const skyPhase = (
  date: Date,
  latitude = defaultLatitude,
  twilightHours = defaultTwilightHours
): SkyPhase => {
  const hour =
    date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const sun = sunTimes(dayOfYear(date), latitude, 12 + summerTimeHours(date));
  return phaseAt(hour, sun, twilightHours);
};
