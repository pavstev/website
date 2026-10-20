import { type LatLon } from "./geo.ts";
import { sunPosition } from "./sky-ephemeris.ts";
import { aimAzimuth, projectSight, type ViewSize } from "./sky-view.ts";

export interface Spot {
  radius: number;
  x: number;
  y: number;
}

export const crawlerInstant = Date.parse("2026-01-20T23:00:00+01:00");
export const sunRadiusShare = 0.026;

const sunrise = -0.833;

export const instantOverride = (search: string): number | undefined => {
  const value = new URLSearchParams(search).get("at");
  if (value === null) return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : ms;
};

export const sunSpot = (
  instant: number,
  view: ViewSize,
  place: LatLon
): Spot | undefined => {
  const sun = sunPosition(instant, place.lat, place.lon);
  if (sun.altitude < sunrise) return undefined;
  const point = projectSight(sun, aimAzimuth(sun, view), view);
  const radius = sunRadiusShare * view.height;
  const { x } = point;
  const y = view.height - point.y;
  const inside =
    x > -radius &&
    x < view.width + radius &&
    y > -radius &&
    y < view.height + radius;
  return inside ? { radius, x, y } : undefined;
};
