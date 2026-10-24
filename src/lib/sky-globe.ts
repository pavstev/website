import { type LatLon } from "./geo.ts";
import { clamp, deg } from "./math.ts";
import { siderealDeg, sunEquatorial, wrap360 } from "./sky-ephemeris.ts";

export interface InertiaStep {
  done: boolean;
  motion: Motion;
  move: Motion;
}

export interface Motion {
  lat: number;
  lon: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const maxLatitude = 80;
export const minZoom = 1;
export const maxZoom = 6;

const inertiaTauMs = 280;
const inertiaStopSpeed = 0.003;
const maxSpeed = 0.5;
const motionBlend = 0.5;
const poleFloor = 0.25;
const wheelRate = 0.002;
const zoomStep = 1.6;

export const wrapLongitude = (lon: number): number => wrap360(lon + 180) - 180;

export const clampLatitude = (lat: number): number =>
  clamp(lat, -maxLatitude, maxLatitude);

export const clampZoom = (zoom: number): number =>
  clamp(zoom, minZoom, maxZoom);

export const toVector = (spot: LatLon): Vec3 => {
  const lat = spot.lat * deg;
  const lon = spot.lon * deg;
  return {
    x: Math.cos(lat) * Math.sin(lon),
    y: Math.sin(lat),
    z: Math.cos(lat) * Math.cos(lon),
  };
};

export const fromVector = (vector: Vec3): LatLon => ({
  lat: Math.asin(clamp(vector.y, -1, 1)) / deg,
  lon: Math.atan2(vector.x, vector.z) / deg,
});

export const dragCenter = (
  center: LatLon,
  dx: number,
  dy: number,
  radiusPx: number,
  zoom: number
): LatLon => {
  const perPixel = 1 / (radiusPx * zoom * deg);
  const stretch = Math.max(Math.cos(center.lat * deg), poleFloor);
  return {
    lat: clampLatitude(center.lat + dy * perPixel),
    lon: wrapLongitude(center.lon - (dx * perPixel) / stretch),
  };
};

export const blendMotion = (
  previous: Motion,
  delta: Motion,
  dtMs: number
): Motion => {
  if (!(dtMs > 0)) return previous;
  const lat = previous.lat + (delta.lat / dtMs - previous.lat) * motionBlend;
  const lon = previous.lon + (delta.lon / dtMs - previous.lon) * motionBlend;
  const speed = Math.hypot(lat, lon);
  const scale = speed > maxSpeed ? maxSpeed / speed : 1;
  return { lat: lat * scale, lon: lon * scale };
};

export const stepInertia = (motion: Motion, dtMs: number): InertiaStep => {
  const keep = Math.exp(-dtMs / inertiaTauMs);
  const reach = inertiaTauMs * (1 - keep);
  const next = { lat: motion.lat * keep, lon: motion.lon * keep };
  return {
    done: Math.hypot(next.lat, next.lon) < inertiaStopSpeed,
    motion: next,
    move: { lat: motion.lat * reach, lon: motion.lon * reach },
  };
};

export const wheelZoom = (zoom: number, deltaY: number): number =>
  clampZoom(zoom * Math.exp(-deltaY * wheelRate));

export const keyMove = (key: string, shift: boolean): Motion | undefined => {
  const size = shift ? 10 : 1;
  switch (key) {
    case "ArrowDown": {
      return { lat: -size, lon: 0 };
    }
    case "ArrowLeft": {
      return { lat: 0, lon: -size };
    }
    case "ArrowRight": {
      return { lat: 0, lon: size };
    }
    case "ArrowUp": {
      return { lat: size, lon: 0 };
    }
    default: {
      return undefined;
    }
  }
};

export const keyZoom = (key: string): number | undefined => {
  if (key === "+" || key === "=") return zoomStep;
  return key === "-" || key === "_" ? 1 / zoomStep : undefined;
};

export const pointUnder = (
  center: LatLon,
  offset: { x: number; y: number },
  radiusPx: number
): LatLon | undefined => {
  const x = offset.x / radiusPx;
  const y = offset.y / radiusPx;
  const rest = 1 - x * x - y * y;
  if (rest < 0) return undefined;
  const z = Math.sqrt(rest);
  const lat = center.lat * deg;
  const lon = center.lon * deg;
  const tiltedY = Math.cos(lat) * y + Math.sin(lat) * z;
  const tiltedZ = -Math.sin(lat) * y + Math.cos(lat) * z;
  return fromVector({
    x: Math.cos(lon) * x + Math.sin(lon) * tiltedZ,
    y: tiltedY,
    z: -Math.sin(lon) * x + Math.cos(lon) * tiltedZ,
  });
};

export const shortestTurn = (from: LatLon, to: LatLon): Motion => ({
  lat: to.lat - from.lat,
  lon: wrapLongitude(to.lon - from.lon),
});

export const subsolarPoint = (ms: number): LatLon => {
  const { dec, ra } = sunEquatorial(ms);
  return { lat: dec, lon: wrapLongitude(ra - siderealDeg(ms, 0)) };
};
