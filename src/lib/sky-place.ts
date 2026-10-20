import { type LatLon, roundPlace, sameSpot, vienna } from "./geo.ts";
import { en } from "./i18n.ts";
import { countryName, type PlaceName } from "./place-name.ts";
import { fillText } from "./template.ts";

export type PlaceStore = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export interface SkyPlace extends LatLon {
  country?: string;
  kind: PlaceKind;
  label: string;
}

type PlaceKind = "vienna" | "visitor";

export const placeKey = "sky-place";

export const placeEvent = "sky:place";

export const placeNamedEvent = "sky:place-named";

const maxLabel = 80;

export const viennaPlace: Readonly<SkyPlace> = {
  kind: "vienna",
  label: en.sky.vienna,
  ...vienna,
};

export const defaultStore = (): PlaceStore | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

const inRange = (value: unknown, limit: number): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  Math.abs(value) <= limit;

const isLabel = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= maxLabel;

const isCountry = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Z]{2}$/.test(value);

const withCountry = (country: unknown): Pick<SkyPlace, "country"> =>
  isCountry(country) ? { country } : {};

export const isPlace = (value: unknown): value is SkyPlace => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { country, kind, label, lat, lon } = value as Record<string, unknown>;
  return (
    (kind === "vienna" || kind === "visitor") &&
    (country === undefined || isCountry(country)) &&
    isLabel(label) &&
    inRange(lat, 90) &&
    inRange(lon, 180)
  );
};

export const coordinateLabel = (spot: LatLon): string =>
  en.sky.coordinates
    .replace("{lat}", () => Math.abs(spot.lat).toFixed(1))
    .replace("{ns}", () => (spot.lat < 0 ? en.sky.south : en.sky.north))
    .replace("{lon}", () => Math.abs(spot.lon).toFixed(1))
    .replace("{ew}", () => (spot.lon < 0 ? en.sky.west : en.sky.east));

export const nearText = (found: PlaceName): string =>
  fillText(en.sky.near, {
    place: fillText(en.sky.named, {
      city: found.name,
      country: countryName(found.country),
    }),
  });

export const placeOverride = (search: string): SkyPlace | undefined => {
  const parts = new URLSearchParams(search)
    .get("place")
    ?.split(",")
    .map((part) => part.trim());
  if (parts?.length !== 2 || parts.includes("")) {
    return undefined;
  }
  const lat = Number(parts[0]);
  const lon = Number(parts[1]);
  if (!inRange(lat, 90) || !inRange(lon, 180)) {
    return undefined;
  }
  const spot = roundPlace({ lat, lon });
  return { kind: "visitor", label: coordinateLabel(spot), ...spot };
};

export const readPlace = (
  store: PlaceStore | undefined = defaultStore()
): SkyPlace | undefined => {
  try {
    const raw = store?.getItem(placeKey);
    const data: unknown = raw ? JSON.parse(raw) : undefined;
    if (typeof data !== "object" || data === null) {
      return undefined;
    }
    const { country, label, lat, lon } = data as Record<string, unknown>;
    return !inRange(lat, 90) || !inRange(lon, 180) || !isLabel(label)
      ? undefined
      : {
          kind: "visitor",
          label,
          ...withCountry(country),
          ...roundPlace({ lat, lon }),
        };
  } catch {
    return undefined;
  }
};

export const savePlace = (
  place: SkyPlace,
  store: PlaceStore | undefined = defaultStore()
): void => {
  try {
    const { lat, lon } = roundPlace(place);
    store?.setItem(
      placeKey,
      JSON.stringify({
        label: place.label,
        lat,
        lon,
        ...withCountry(place.country),
      })
    );
  } catch {}
};

export const clearPlace = (
  store: PlaceStore | undefined = defaultStore()
): void => {
  try {
    store?.removeItem(placeKey);
  } catch {}
};

export const startPlace = (
  search: string,
  crawler: boolean,
  store: PlaceStore | undefined = defaultStore()
): SkyPlace =>
  crawler
    ? viennaPlace
    : (placeOverride(search) ?? readPlace(store) ?? viennaPlace);

let chosen: SkyPlace | undefined;

export const chosenPlace = (): SkyPlace | undefined => chosen;

export const choosePlace = (
  place: SkyPlace | undefined,
  store: PlaceStore | undefined = defaultStore(),
  target: EventTarget = globalThis
): void => {
  if (place) {
    savePlace(place, store);
  } else {
    clearPlace(store);
  }
  chosen = place ?? viennaPlace;
  target.dispatchEvent(
    new CustomEvent<SkyPlace>(placeEvent, { detail: chosen })
  );
};

export const namePlace = (
  spot: LatLon,
  found: PlaceName,
  store: PlaceStore | undefined = defaultStore(),
  target: EventTarget = globalThis
): void => {
  const at = roundPlace(spot);
  if (chosen && (chosen.kind !== "visitor" || !sameSpot(chosen, at))) {
    return;
  }
  const named: SkyPlace = {
    kind: "visitor",
    label: found.name.slice(0, maxLabel),
    ...withCountry(found.country),
    ...at,
  };
  const saved = readPlace(store);
  if (saved && sameSpot(saved, at)) {
    savePlace(named, store);
  }
  chosen = named;
  target.dispatchEvent(
    new CustomEvent<SkyPlace>(placeNamedEvent, { detail: named })
  );
};
