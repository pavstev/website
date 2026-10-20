import { type LatLon } from "./geo.ts";
import { clamp, deg, smoothstep } from "./math.ts";
import { sunPosition } from "./sky-ephemeris.ts";
import { type SkyTable, type TableInput } from "./sky-light.ts";
import { airTint, moonView, screenAngle } from "./sky-moon.ts";
import { paintPalettes, paintTints } from "./sky-palette.ts";
import { sunRadiusShare } from "./sky-sun.ts";
import {
  aimAzimuth,
  blendAim,
  projectSight,
  type ViewSize,
} from "./sky-view.ts";
import { hexBytes } from "./theme.ts";
import { type SkyWeather, windDrift } from "./weather.ts";

export interface PaintScene {
  alto: number;
  aura: number;
  cirrus: number;
  corona: readonly [number, number, number];
  cumulus: number;
  drift: number;
  earth: number;
  fog: number;
  glow: number;
  grey: number;
  haze: number;
  light: readonly [number, number];
  lightColor: Rgb;
  lit: Rgb;
  low: Rgb;
  lutMix: number;
  mid: Rgb;
  moon: readonly [number, number, number, number];
  moonColor: Rgb;
  moonGlow: number;
  moonLight: Rgb;
  moonNorth: readonly [number, number];
  moonTint: Rgb;
  overcast: number;
  rain: number;
  shade: Rgb;
  snow: number;
  spaceColor: Rgb;
  stars: number;
  sun: readonly [number, number, number];
  sunColor: Rgb;
  sunUp: number;
  top: Rgb;
}

export type Rgb = readonly [number, number, number];

interface PaintPalette {
  lit: Rgb;
  low: Rgb;
  mid: Rgb;
  shade: Rgb;
  sun: Rgb;
  top: Rgb;
}

type PaletteName = keyof typeof paintPalettes;

type Tone = keyof PaintPalette;

const tones: readonly Tone[] = ["top", "mid", "low", "lit", "shade", "sun"];

const moonScale = 1.85;
const moonAura = 0.55;

const unit = (color: Rgb): Rgb => [
  color[0] / 255,
  color[1] / 255,
  color[2] / 255,
];

const mixRgb = (from: Rgb, to: Rgb, share: number): Rgb => [
  from[0] + (to[0] - from[0]) * share,
  from[1] + (to[1] - from[1]) * share,
  from[2] + (to[2] - from[2]) * share,
];

const scaleRgb = (color: Rgb, by: number): Rgb => [
  color[0] * by,
  color[1] * by,
  color[2] * by,
];

const tint = (name: keyof typeof paintTints): Rgb =>
  unit(hexBytes(paintTints[name]));

const paletteOf = (name: PaletteName): PaintPalette => {
  const source = paintPalettes[name];
  return {
    lit: unit(hexBytes(source.lit)),
    low: unit(hexBytes(source.low)),
    mid: unit(hexBytes(source.mid)),
    shade: unit(hexBytes(source.shade)),
    sun: unit(hexBytes(source.sun)),
    top: unit(hexBytes(source.top)),
  };
};

const mixPalette = (
  from: PaintPalette,
  to: PaintPalette,
  share: number
): PaintPalette => ({
  lit: mixRgb(from.lit, to.lit, share),
  low: mixRgb(from.low, to.low, share),
  mid: mixRgb(from.mid, to.mid, share),
  shade: mixRgb(from.shade, to.shade, share),
  sun: mixRgb(from.sun, to.sun, share),
  top: mixRgb(from.top, to.top, share),
});

export const nightAim = (sunAltitude: number, moonAltitude: number): number =>
  smoothstep(-2, -8, sunAltitude) * smoothstep(-3, 2, moonAltitude);

const rainPalette = (dayness: number): PaintPalette => {
  const rain = paletteOf("rain");
  const dim = 0.22 + 0.78 * dayness;
  const out = { ...rain };
  for (const tone of tones)
    if (tone !== "sun") out[tone] = scaleRgb(rain[tone], dim);
  return out;
};

const deckRise = [0, 1.5] as const;
const deckLevel = 0.9;
const rainDeckLevel = 0.75;

const deckLight = (weather: SkyWeather, sunAltitude: number): number =>
  smoothstep(deckRise[0], deckRise[1], sunAltitude) *
  smoothstep(0.5, 0.85, weather.overcast) *
  (1 - weather.snow) *
  (1 - weather.fog);

const greyPalette = (
  dayness: number,
  light: number,
  rain: number
): PaintPalette => {
  const dim = rainPalette(dayness);
  if (light <= 0) return dim;
  const deck = paletteOf("overcast");
  const level = deckLevel + (rainDeckLevel - deckLevel) * rain;
  const bright = { ...deck };
  for (const tone of tones)
    if (tone !== "sun") bright[tone] = scaleRgb(deck[tone], level);
  return mixPalette(dim, bright, light);
};

const tablePalette = (
  table: SkyTable,
  night: PaintPalette,
  sunAltitude: number
): PaintPalette => {
  const dark = 1 - smoothstep(-16, -6, sunAltitude);
  return {
    lit: mixRgb(table.lit, night.lit, dark),
    low: table.low,
    mid: table.mid,
    shade: mixRgb(table.shade, night.shade, dark),
    sun: table.sunColor,
    top: table.top,
  };
};

const aim = (
  instant: number,
  view: ViewSize,
  place: LatLon
): {
  center: number;
  moon: ReturnType<typeof moonView>;
  sun: ReturnType<typeof sunPosition>;
} => {
  const sun = sunPosition(instant, place.lat, place.lon);
  const moon = moonView(instant, place.lat, place.lon);
  const night = nightAim(sun.altitude, moon.altitude);
  const center = blendAim(aimAzimuth(sun, view), aimAzimuth(moon, view), night);
  return { center, moon, sun };
};

export const tableInput = (
  instant: number,
  view: ViewSize,
  weather: SkyWeather,
  place: LatLon
): TableInput => {
  const { center, moon, sun } = aim(instant, view, place);
  return {
    center,
    haze: weather.haze,
    moon: {
      altitude: moon.altitude,
      azimuth: moon.azimuth,
      fraction: moon.fraction,
    },
    sun: { altitude: sun.altitude, azimuth: sun.azimuth },
    view,
  };
};

export const spaceBand = 0.24;

export const starShare = (sunAltitude: number): number =>
  clamp((-sunAltitude - 1) / 8, 0, 1);

const onScreen = (x: number, y: number, view: ViewSize): boolean =>
  x > -0.2 * view.width && x < 1.2 * view.width && y < 1.08 * view.height;

export const paintScene = (
  instant: number,
  view: ViewSize,
  weather: SkyWeather,
  place: LatLon,
  table?: SkyTable
): PaintScene => {
  const { center, moon, sun } = aim(instant, view, place);
  const sunAt = projectSight(sun, center, view);
  const moonAt = projectSight(moon, center, view);
  const { overcast } = weather;
  const dayness = smoothstep(-8, 8, sun.altitude);
  const night = paletteOf("night");
  const grey = overcast * 0.8;
  let palette = mixPalette(
    table ? tablePalette(table, night, sun.altitude) : night,
    greyPalette(dayness, deckLight(weather, sun.altitude), weather.rain),
    grey
  );
  const sunRadius = sunRadiusShare * view.height;
  const moonUp = smoothstep(-1.5, 0.5, moon.altitude);
  const visible =
    moonUp *
    (1 - 0.85 * overcast) *
    (onScreen(moonAt.x, moonAt.y, view) ? 1 : 0);
  const dark = 1 - smoothstep(-6, 2, sun.altitude);
  const moonShare = visible * dark * (0.35 + 0.65 * moon.fraction);
  const moonLit = mixRgb(palette.lit, tint("moonlit"), moonShare * 0.7);
  const cityUnit = tint("city");
  palette = {
    ...palette,
    lit: mixRgb(
      moonLit,
      scaleRgb(cityUnit, 70 / 255),
      (1 - dayness) * overcast * 0.4
    ),
  };
  const dayLight = smoothstep(-6, -1, sun.altitude);
  const lightX = view.width / 2 + (sunAt.x - view.width / 2) * dayLight;
  const lightY =
    -0.7 * view.height +
    (Math.max(sunAt.y, -0.2 * view.height) + 0.7 * view.height) * dayLight;
  const sunColor = palette.sun;
  const limb = screenAngle(moon.brightLimb, moon.parallactic) * deg;
  const north = screenAngle(moon.pole, moon.parallactic) * deg;
  const lit = Math.sin(moon.phaseAngle * deg);
  return {
    alto: weather.alto,
    aura: moonAura,
    cirrus: weather.cirrus,
    corona: [0, 0, 0],
    cumulus: weather.cumulus,
    drift: windDrift(weather.windKmh, weather.windFrom, center),
    earth: (1 - moon.fraction) * dark,
    fog: weather.fog,
    glow: table
      ? 0.3 * smoothstep(-4, 2, sun.altitude) * (1 - 0.7 * overcast)
      : 0,
    grey,
    haze: weather.haze,
    light: [
      lightX + (moonAt.x - lightX) * moonShare * 0.9,
      lightY + (moonAt.y - lightY) * moonShare * 0.9,
    ],
    lightColor: mixRgb(
      mixRgb(cityUnit, sunColor, dayLight),
      tint("moonlight"),
      moonShare
    ),
    lit: palette.lit,
    low: palette.low,
    lutMix: table ? 1 : 0,
    mid: palette.mid,
    moon: [
      moonAt.x,
      moonAt.y,
      sunRadius * (moon.angularRadius / sun.angularRadius) * moonScale,
      visible,
    ],
    moonColor: tint("moon"),
    moonGlow: visible * moon.fraction * (0.3 + 0.7 * dark),
    moonLight: [
      Math.sin(limb) * lit,
      Math.cos(limb) * lit,
      Math.cos(moon.phaseAngle * deg),
    ],
    moonNorth: [Math.sin(north), Math.cos(north)],
    moonTint: airTint(moon.altitude),
    overcast,
    rain: weather.rain,
    shade: palette.shade,
    snow: weather.snow,
    spaceColor: tint("space"),
    stars:
      starShare(sun.altitude) *
      (1 - overcast) *
      (1 - 0.35 * moonShare * moon.fraction),
    sun: [sunAt.x, sunAt.y, sunRadius],
    sunColor,
    sunUp: smoothstep(-1.5, 0.5, sun.altitude) * (1 - 0.9 * overcast),
    top: palette.top,
  };
};

export const coronaSpot = (view: ViewSize): { x: number; y: number } => ({
  x: -0.08 * view.width,
  y: 1.12 * view.height,
});

export const nightScene = (view: ViewSize, weather: SkyWeather): PaintScene => {
  const night = paletteOf("night");
  const spot = coronaSpot(view);
  const coronaTint = tint("corona");
  return {
    alto: weather.alto,
    aura: moonAura,
    cirrus: weather.cirrus,
    corona: [spot.x, spot.y, 1],
    cumulus: weather.cumulus,
    drift: windDrift(weather.windKmh, weather.windFrom, 180),
    earth: 0,
    fog: 0,
    glow: 0,
    grey: 0,
    haze: weather.haze,
    light: [spot.x, spot.y],
    lightColor: coronaTint,
    lit: mixRgb(night.lit, coronaTint, 0.25),
    low: night.low,
    lutMix: 0,
    mid: night.mid,
    moon: [0, 0, 0, 0],
    moonColor: tint("moon"),
    moonGlow: 0,
    moonLight: [0, 0, 1],
    moonNorth: [0, 1],
    moonTint: [1, 1, 1],
    overcast: weather.overcast,
    rain: 0,
    shade: night.shade,
    snow: 0,
    spaceColor: tint("space"),
    stars: 1 - weather.overcast,
    sun: [spot.x, spot.y, 0],
    sunColor: night.sun,
    sunUp: 0,
    top: night.top,
  };
};

const blend = (from: number, to: number, share: number): number =>
  from * (1 - share) + to * share;

const blendRgb = (from: Rgb, to: Rgb, share: number): Rgb => [
  blend(from[0], to[0], share),
  blend(from[1], to[1], share),
  blend(from[2], to[2], share),
];

const blendPair = (
  from: readonly [number, number],
  to: readonly [number, number],
  share: number
): readonly [number, number] => [
  blend(from[0], to[0], share),
  blend(from[1], to[1], share),
];

export const mixScene = (
  from: PaintScene,
  to: PaintScene,
  t: number
): PaintScene => ({
  alto: blend(from.alto, to.alto, t),
  aura: blend(from.aura, to.aura, t),
  cirrus: blend(from.cirrus, to.cirrus, t),
  corona: blendRgb(from.corona, to.corona, t),
  cumulus: blend(from.cumulus, to.cumulus, t),
  drift: blend(from.drift, to.drift, t),
  earth: blend(from.earth, to.earth, t),
  fog: blend(from.fog, to.fog, t),
  glow: blend(from.glow, to.glow, t),
  grey: blend(from.grey, to.grey, t),
  haze: blend(from.haze, to.haze, t),
  light: blendPair(from.light, to.light, t),
  lightColor: blendRgb(from.lightColor, to.lightColor, t),
  lit: blendRgb(from.lit, to.lit, t),
  low: blendRgb(from.low, to.low, t),
  lutMix: blend(from.lutMix, to.lutMix, t),
  mid: blendRgb(from.mid, to.mid, t),
  moon: [
    blend(from.moon[0], to.moon[0], t),
    blend(from.moon[1], to.moon[1], t),
    blend(from.moon[2], to.moon[2], t),
    blend(from.moon[3], to.moon[3], t),
  ],
  moonColor: blendRgb(from.moonColor, to.moonColor, t),
  moonGlow: blend(from.moonGlow, to.moonGlow, t),
  moonLight: blendRgb(from.moonLight, to.moonLight, t),
  moonNorth: blendPair(from.moonNorth, to.moonNorth, t),
  moonTint: blendRgb(from.moonTint, to.moonTint, t),
  overcast: blend(from.overcast, to.overcast, t),
  rain: blend(from.rain, to.rain, t),
  shade: blendRgb(from.shade, to.shade, t),
  snow: blend(from.snow, to.snow, t),
  spaceColor: blendRgb(from.spaceColor, to.spaceColor, t),
  stars: blend(from.stars, to.stars, t),
  sun: blendRgb(from.sun, to.sun, t),
  sunColor: blendRgb(from.sunColor, to.sunColor, t),
  sunUp: blend(from.sunUp, to.sunUp, t),
  top: blendRgb(from.top, to.top, t),
});

interface ShotPose {
  corona: { x: number; y: number };
  disk: number;
  sun: undefined | { x: number; y: number };
}

export const shotScene = (
  home: PaintScene,
  night: PaintScene,
  mix: number,
  pose: ShotPose
): PaintScene => ({
  ...mixScene(home, night, mix),
  corona: [pose.corona.x, pose.corona.y, mix],
  moon: [home.moon[0], home.moon[1], home.moon[2], home.moon[3] * (1 - mix)],
  moonLight: home.moonLight,
  moonNorth: home.moonNorth,
  moonTint: home.moonTint,
  sun: [pose.sun?.x ?? home.sun[0], pose.sun?.y ?? home.sun[1], home.sun[2]],
  sunUp: home.sunUp * pose.disk,
});
