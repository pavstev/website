import { deg } from "./math.ts";
import { sunPosition } from "./sky-ephemeris.ts";
import {
  aimYaw,
  cameraBasis,
  projectDisk,
  skyCamera,
  type ViewSize,
  worldDirection,
} from "./sky-view.ts";

export interface Spot {
  radius: number;
  x: number;
  y: number;
}

export const crawlerInstant = Date.parse("2026-01-20T23:00:00+01:00");
const viennaLatitude = 48.2082;
const viennaLongitude = 16.3738;

const sunGain = 7.5;
const sunrise = -0.833;

export const instantOverride = (search: string): number | undefined => {
  const value = new URLSearchParams(search).get("at");
  if (value === null) return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : ms;
};

export const sunSpot = (instant: number, view: ViewSize): Spot | undefined => {
  const sun = sunPosition(instant, viennaLatitude, viennaLongitude);
  if (sun.altitude < sunrise) return undefined;
  const disk = projectDisk(
    worldDirection(sun.altitude, sun.azimuth),
    sun.angularRadius * deg * sunGain,
    cameraBasis(aimYaw(sun, view), 0),
    skyCamera(view.width, view.height),
    view.width,
    view.height
  );
  if (!disk) return undefined;
  const [x, y, radius] = disk;
  const inside =
    x > -radius &&
    x < view.width + radius &&
    y > -radius &&
    y < view.height + radius;
  return inside ? { radius, x, y } : undefined;
};
