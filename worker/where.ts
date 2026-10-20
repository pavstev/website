import { distanceKm, type LatLon, roundPlace, vienna } from "../src/lib/geo.ts";
import { failure, withSecurityHeaders } from "./http.ts";

export const wherePath = "/where";

const farKm = 100;

export interface WhereAnswer {
  city: null | string;
  far: boolean | null;
  lat: null | number;
  lon: null | number;
}

export interface WhereCf {
  city?: string;
  latitude?: string;
  longitude?: string;
}

const coordinate = (text: string | undefined): number =>
  text?.trim() ? Number(text) : NaN;

const parseSpot = (cf: undefined | WhereCf): LatLon | undefined => {
  const lat = coordinate(cf?.latitude);
  const lon = coordinate(cf?.longitude);

  return !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
    ? undefined
    : roundPlace({ lat, lon });
};

const parseCity = (cf: undefined | WhereCf): null | string => {
  const city = cf?.city?.trim() ?? "";

  return city.length > 0 ? city : null;
};

export const whereAnswer = (cf: undefined | WhereCf): WhereAnswer => {
  const city = parseCity(cf);
  const spot = parseSpot(cf);

  if (!spot) {
    return { city, far: null, lat: null, lon: null };
  }

  return {
    city,
    far: distanceKm(spot, vienna) > farKm,
    lat: spot.lat,
    lon: spot.lon,
  };
};

export const handleWhere = (
  request: Request,
  cf: undefined | WhereCf
): Response => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return failure(405, "Method not allowed", { Allow: "GET, HEAD" });
  }

  return withSecurityHeaders(
    Response.json(whereAnswer(cf), {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
      },
    })
  );
};
