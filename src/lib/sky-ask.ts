import { distanceKm, type LatLon, roundPlace } from "./geo.ts";
import {
  coordinateLabel,
  defaultStore,
  type PlaceStore,
  type SkyPlace,
} from "./sky-place.ts";

export type Arrow = "down" | "none" | "up";

export interface AskContext {
  asked: boolean;
  crawler: boolean;
  home: boolean;
  lightLoad: boolean;
  pinned: boolean;
  saved: boolean;
}

export interface Rect {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export interface SkySpot {
  kind: "moon" | "none" | "sun";
  radius: number;
  x: number;
  y: number;
}

export interface WhereHint {
  city: null | string;
  lat: null | number;
  lon: null | number;
}

export interface WhereReply extends WhereHint {
  far: boolean | null;
}

export const askedKey = "sky-place-asked";

export const spotEvent = "sky:spot";

export const askDelayMs = 6000;

export const doneMs = 6000;

export const deniedMs = 4000;

const noSpot: SkySpot = { kind: "none", radius: 0, x: 0, y: 0 };
const hintKm = 50;
const maxLabel = 80;
const maxCity = 60;
const bubbleGap = 12;
const bubbleMargin = 16;
const footerRoom = 96;
const lookupMs = 10_000;
const guardMs = 11_000;
const cachedMs = 1_800_000;

export const mayAsk = (context: AskContext): boolean =>
  context.home &&
  !context.asked &&
  !context.crawler &&
  !context.lightLoad &&
  !context.pinned &&
  !context.saved;

export const forcedCity = (search: string): string | undefined => {
  const city = new URLSearchParams(search).get("bubble")?.trim() ?? "";
  return city.length > 0 && city.length <= maxCity ? city : undefined;
};

export const hintLabel = (
  spot: LatLon,
  hint: undefined | WhereHint
): string => {
  const city = hint?.city?.trim().slice(0, maxLabel).trim() ?? "";
  const near =
    hint?.lat != null &&
    hint.lon != null &&
    distanceKm(spot, { lat: hint.lat, lon: hint.lon }) <= hintKm;
  return near && city.length > 0 ? city : coordinateLabel(spot);
};

const orNull = <T>(
  value: unknown,
  test: (item: unknown) => item is T
): null | T => (test(value) ? value : null);

const isText = (value: unknown): value is string => typeof value === "string";

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isFlag = (value: unknown): value is boolean => typeof value === "boolean";

export const parseWhere = (body: unknown): undefined | WhereReply => {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }
  const { city, far, lat, lon } = body as Record<string, unknown>;
  return {
    city: orNull(city, isText),
    far: orNull(far, isFlag),
    lat: orNull(lat, isNumber),
    lon: orNull(lon, isNumber),
  };
};

export type Fetcher = (
  url: string,
  init?: { signal: AbortSignal | null }
) => Promise<Pick<Response, "json" | "ok">>;

export const fetchWhere = async (
  signal?: AbortSignal,
  fetcher: Fetcher = fetch
): Promise<undefined | WhereReply> => {
  try {
    const response = await fetcher("/where", { signal: signal ?? null });
    return response.ok ? parseWhere(await response.json()) : undefined;
  } catch {
    return undefined;
  }
};

export const placeFromWhere = (
  reply: undefined | WhereReply
): SkyPlace | undefined => {
  if (reply?.lat == null || reply.lon == null) return undefined;
  const spot = roundPlace({ lat: reply.lat, lon: reply.lon });
  return { kind: "visitor", label: hintLabel(spot, reply), ...spot };
};

let askedInMemory = false;

export const wasAsked = (
  store: PlaceStore | undefined = defaultStore()
): boolean => {
  try {
    return typeof store?.getItem(askedKey) === "string" || askedInMemory;
  } catch {
    return askedInMemory;
  }
};

export const markAsked = (
  store: PlaceStore | undefined = defaultStore()
): void => {
  try {
    store?.setItem(askedKey, "1");
  } catch {
    askedInMemory = true;
  }
};

let lastSpot: SkySpot | undefined;

export const currentSpot = (): SkySpot | undefined => lastSpot;

const sameSpot = (a: SkySpot | undefined, b: SkySpot): boolean =>
  a?.kind === b.kind &&
  Math.round(a.x) === Math.round(b.x) &&
  Math.round(a.y) === Math.round(b.y) &&
  Math.round(a.radius) === Math.round(b.radius);

export const publishSpot = (
  spot: SkySpot,
  target: EventTarget = globalThis
): void => {
  if (sameSpot(lastSpot, spot)) return;
  lastSpot = spot;
  target.dispatchEvent(new CustomEvent<SkySpot>(spotEvent, { detail: spot }));
};

const onScreen = (
  x: number,
  y: number,
  radius: number,
  height: number,
  width: number
): boolean => radius > 0 && x >= 0 && x <= width && y >= 0 && y <= height;

export const skySpot = (
  moon: readonly [number, number, number, number],
  sun: readonly [number, number, number],
  height: number,
  width = Infinity
): SkySpot => {
  if (onScreen(sun[0], sun[1], sun[2], height, width)) {
    return { kind: "sun", radius: sun[2], x: sun[0], y: height - sun[1] };
  }
  return moon[3] > 0 && onScreen(moon[0], moon[1], moon[2], height, width)
    ? { kind: "moon", radius: moon[2], x: moon[0], y: height - moon[1] }
    : { kind: "none", radius: 0, x: 0, y: 0 };
};

export const bubbleBox = (
  spot: SkySpot,
  viewport: { height: number; width: number },
  bubble: { height: number; width: number }
): { arrow: boolean; left: number; top: number } => {
  const corner = {
    arrow: false,
    left: viewport.width - bubble.width - bubbleMargin,
    top: viewport.height - footerRoom - bubble.height,
  };
  if (spot.kind === "none") return corner;
  const top = spot.y + spot.radius + bubbleGap;
  return top + bubble.height > viewport.height - footerRoom
    ? corner
    : { arrow: true, left: centeredLeft(spot, viewport, bubble), top };
};

const centeredLeft = (
  spot: SkySpot,
  viewport: { width: number },
  bubble: { width: number }
): number =>
  Math.max(
    bubbleMargin,
    Math.min(
      spot.x - bubble.width / 2,
      viewport.width - bubble.width - bubbleMargin
    )
  );

const overlapArea = (
  box: { left: number; top: number },
  bubble: { height: number; width: number },
  rect: Rect
): number =>
  Math.max(
    0,
    Math.min(box.left + bubble.width, rect.right) -
      Math.max(box.left, rect.left)
  ) *
  Math.max(
    0,
    Math.min(box.top + bubble.height, rect.bottom) - Math.max(box.top, rect.top)
  );

const controlWeight = 4;

const sweepStep = 8;

export const chooseBox = (
  spot: SkySpot,
  viewport: { height: number; width: number },
  bubble: { height: number; width: number },
  texts: readonly Rect[],
  controls: readonly Rect[] = []
): { arrow: Arrow; left: number; top: number } => {
  const corner = bubbleBox(noSpot, viewport, bubble);
  const options: Array<{ arrow: Arrow; left: number; top: number }> = [];
  if (spot.kind !== "none") {
    const under = bubbleBox(spot, viewport, bubble);
    if (under.arrow) {
      options.push({ arrow: "up", left: under.left, top: under.top });
    }
    const above = spot.y - spot.radius - bubbleGap - bubble.height;
    if (above >= bubbleMargin) {
      options.push({
        arrow: "down",
        left: centeredLeft(spot, viewport, bubble),
        top: above,
      });
    }
  }
  options.push(
    { arrow: "none", left: corner.left, top: corner.top },
    { arrow: "none", left: corner.left, top: bubbleMargin }
  );
  const cost = (option: { left: number; top: number }): number =>
    texts.reduce((sum, rect) => sum + overlapArea(option, bubble, rect), 0) +
    controlWeight *
      controls.reduce(
        (sum, rect) => sum + overlapArea(option, bubble, rect),
        0
      );
  let best = options[0] ?? {
    arrow: "none",
    left: corner.left,
    top: corner.top,
  };
  let least = Infinity;
  for (const option of options) {
    const covered = cost(option);
    if (!(covered < least)) continue;
    best = option;
    least = covered;
  }
  const last = viewport.height - footerRoom - bubble.height;
  for (let top = bubbleMargin; least > 0 && top <= last; top += sweepStep) {
    const option = { arrow: "none" as const, left: corner.left, top };
    const covered = cost(option);
    if (!(covered < least)) continue;
    best = option;
    least = covered;
  }
  return best;
};

export const askPosition = (
  geo: Pick<Geolocation, "getCurrentPosition"> | undefined,
  guard = guardMs
): Promise<LatLon | undefined> =>
  new Promise((resolve) => {
    if (!geo) {
      resolve(undefined);
      return;
    }
    const timer = setTimeout(() => resolve(undefined), guard);
    const settle = (spot: LatLon | undefined): void => {
      clearTimeout(timer);
      resolve(spot);
    };
    try {
      geo.getCurrentPosition(
        ({ coords }) => {
          const { latitude: lat, longitude: lon } = coords;
          settle(
            Number.isFinite(lat) &&
              Number.isFinite(lon) &&
              Math.abs(lat) <= 90 &&
              Math.abs(lon) <= 180
              ? roundPlace({ lat, lon })
              : undefined
          );
        },
        () => settle(undefined),
        {
          enableHighAccuracy: false,
          maximumAge: cachedMs,
          timeout: lookupMs,
        }
      );
    } catch {
      settle(undefined);
    }
  });
