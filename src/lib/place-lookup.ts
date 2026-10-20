import { type LatLon, roundPlace } from "./geo.ts";
import {
  decodePlaces,
  nearestPlace,
  type PlaceName,
  type PlaceTable,
} from "./place-name.ts";

export type PlaceLoader = () => Promise<string>;

export const createPlaceLookup = (
  load: PlaceLoader
): ((spot: LatLon) => Promise<PlaceName | undefined>) => {
  let table: Promise<PlaceTable> | undefined;
  return async (spot) => {
    table ??= (async () => decodePlaces(await load()))();
    let found: PlaceName | undefined;
    try {
      found = nearestPlace(await table, roundPlace(spot));
    } catch {
      table = undefined;
    }
    return found;
  };
};
