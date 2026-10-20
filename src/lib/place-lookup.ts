import { type LatLon, roundPlace } from "./geo.ts";
import {
  decodePlaces,
  nearbyPlace,
  nearestPlace,
  type NearPlace,
  type PlaceName,
  type PlaceTable,
} from "./place-name.ts";

export type PlaceLoader = () => Promise<string>;

export interface PlaceSource {
  lookup: (spot: LatLon) => Promise<PlaceName | undefined>;
  near: (spot: LatLon) => Promise<NearPlace | undefined>;
  table: () => Promise<PlaceTable>;
}

export const createPlaceSource = (load: PlaceLoader): PlaceSource => {
  let cached: Promise<PlaceTable> | undefined;
  const table = (): Promise<PlaceTable> => {
    if (cached) return cached;
    const pending = (async () => decodePlaces(await load()))();
    cached = pending;
    void pending.catch(() => {
      if (cached === pending) cached = undefined;
    });
    return pending;
  };
  const lookup = async (spot: LatLon): Promise<PlaceName | undefined> => {
    try {
      return nearestPlace(await table(), roundPlace(spot));
    } catch {
      return undefined;
    }
  };
  const near = async (spot: LatLon): Promise<NearPlace | undefined> => {
    try {
      return nearbyPlace(await table(), roundPlace(spot));
    } catch {
      return undefined;
    }
  };
  return { lookup, near, table };
};
