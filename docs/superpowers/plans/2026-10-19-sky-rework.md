# Sky Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the painted sky: real light at dusk, a wider view with a space band, a real drawn moon, no skyline, live weather for the visitor's own place, and the painted night with corona rays on the blog, `/work` and `/about`.

**Architecture:** Pure modules in `src/lib` hold the math (place, weather mapping, sky light table, scenes, bubble rules) and get `node --test` tests. `space-background.tsx` keeps one WebGL1 context with two programs (`cloud`, `paint`) on every page; a second small context draws the sharp moon on home. The browser asks Open-Meteo directly; the Worker answers only `/mcp` and the new `/where`.

**Tech Stack:** Astro 7 static, React 19 islands, WebGL1 GLSL in TS strings, Cloudflare Worker, sharp (already a dev dependency) for the moon map, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-19-sky-rework-design.md`. Look reference: `_ref/sky-rework/` (local only, ignored by git): `scatter.ts`, `moon-map.ts`, `shaders.ts`, `preview.ts` and the pick page `sky-rework-picks.html`. A helper in another checkout needs a copy of that folder.

## Global Constraints

- Work in `/Users/pavstev/work/website` on `main`. Run every command from the repo root.
- No new npm dependency.
- No comments, JSDoc, TODO, FIXME, XXX or HACK in source. No `eslint-disable`. No `any`. No `!` non-null assertions. Explicit return types on exports. `import { type Foo }`.
- No hex or hsl outside `src/styles/*.css` and `src/lib/theme.ts`. New tokens: `paintTints.corona` `#FFE6C4` and `paintTints.space` `#04060E`.
- No inline UI strings. New copy goes to `src/lib/i18n.ts` (`en.sky`, two `en.privacy` lines), verbatim from spec 4.8 and 4.10.
- Tailwind v4 paren syntax.
- Copy, docs and commit text: no em dashes, no taglines, short plain sentences.
- Modules in `src/lib`, `scripts` and `worker` import siblings with the `.ts` extension (node runs the tests with type stripping).
- Tests use `node:test` and `node:assert/strict` with `describe` and `it`, in a file next to the module.
- A visitor place is rounded to 0.1 degree before any other code sees it. It is stored only in `localStorage` key `sky-place` (`lat`, `lon`, `label`). The bubble flag is `localStorage` key `sky-place-asked`. Every storage access sits inside `try`/`catch`.
- Crawlers always get Vienna, no weather request and no bubble.
- Weather: `GET https://api.open-meteo.com/v1/forecast`, timeout 8 s, `sessionStorage` cache 15 min, a new request when a hidden tab comes back after 30 min or more. No `setInterval`. No request while the tab is hidden.
- The "Weather: Open-Meteo" credit link stays visible in every footer whose page shows live weather (CC BY 4.0).
- Texture units in the main context: 0 probe (never sample it), 1 clouds, 2 sky light table, 3 moon map. Set samplers with `gl.uniform1i`; the uniform sink sends floats only.
- First paint and start long tasks stay as today. The weather request, `/where`, the moon map and the moon layer start after the first frame.
- Budgets: moon map under 60 KB; moon layer under 0.3 ms GPU per frame at device pixel ratio 2; one sky light table build under 16 ms at 4x CPU slowdown.
- Never run `wrangler deploy` or `pnpm deploy`. Never push unless the owner asks. Never touch the Cloudflare account "Alpha.therapybg".
- No real-iPhone checks. Emulate WebKit in Playwright. Test scripts, reports and screenshots stay outside the repo (scratchpad); run Playwright from `~/powertools/tools/site-audit` and open `http://localhost:4321`.
- Commits: Conventional Commits, one commit per part, no co-author line, no "Generated with" line. Before each commit run `git fetch` and `git log --oneline -3 origin/main`; other sessions share `main`, so rebase the local part commits onto `origin/main` when it moved. Stage only the part's own paths. The husky hook runs `pnpm check` (2 to 3 min): run the commit in the background and read its exit line. Do not run `pnpm check` again just before a commit.
- Export only what another file (code or test) imports: knip runs with `ignoreExportsUsedInFile: false`, so a constant used only in its own file stays unexported. `pnpm exec knip` must stay clean after every part.
- Run `pnpm fix` early in each part. After 2 failed tries on one step, stop and report.

## Review Focus

1. Places far from Vienna: south, west, polar day and night, the date line. Expected: the right sun, moon and stars and no NaN in any uniform. Tests: Task 1 (`roundPlace` wraps and clamps) and Task 2 (finite scenes for Sydney, Tromsø and the date line).
2. Odd Open-Meteo answers: `null` visibility, humidity or precipitation, no layer covers, covers above 100 or below 0, an HTML error page, a 429. Expected: the best weather the data allows, else the fallback, never a throw. Tests: Task 3 and Task 4.
3. Broken or edited storage: `localStorage` throws (private mode), or `sky-place` holds junk, out-of-range numbers or a huge label. Expected: Vienna and no throw. Test: Task 1.
4. Overlapping loads: two callers for one place, a place change while a request runs. Expected: one request per place, and the answer for an old place is dropped. Tests: Task 4 (`loadWeather` shares one request per place, `samePlace`).
5. Bubble timing: the visitor leaves home before 6 s, or the browser never answers the location prompt. Expected: no bubble and no `/where` call after leaving; a prompt with no answer ends in "No problem. Vienna it is." Tests: Task 17 (`askPosition` guard) and Task 20 (Playwright: leave at 3 s).

## Files

| File                                                                                    | Change | Job                                                                            |
| --------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| `src/lib/geo.ts`                                                                        | create | `LatLon`, `vienna`, `roundPlace`, `distanceKm` (shared with the Worker)        |
| `src/lib/sky-place.ts`                                                                  | create | `SkyPlace`, storage, `?place=`, start place, `choosePlace`, coordinate label   |
| `src/lib/weather.ts`                                                                    | modify | Open-Meteo report, layered `SkyWeather`, presets, `weatherWord`                |
| `src/lib/weather-client.ts`                                                             | create | URL, cache, timeout, one request per place                                     |
| `src/lib/sky-light.ts`                                                                  | create | port of `scatter.ts`, `skyTable`                                               |
| `src/lib/sky-sun.ts`, `sky-view.ts`, `sky-moon.ts`, `sky-paint.ts`                      | modify | place, view B2, moon size and air tint, table colors, night look, scene mix    |
| `src/lib/sky-paint-shader.ts`                                                           | modify | cloud layers, table, band, star gate, corona, meteor; skyline deleted          |
| `src/lib/sky-moon-shader.ts`, `src/lib/moon-layer.ts`                                   | create | the one moon GLSL chunk; the sharp moon canvas                                 |
| `src/lib/sky-ask.ts`                                                                    | create | bubble rules, sky spot, placement, location prompt                             |
| `src/components/space-background.tsx`                                                   | modify | wiring                                                                         |
| `src/components/sky-bubble.tsx`, `src/components/sky-picker.tsx`                        | create | bubble and footer picker                                                       |
| `scripts/moon-map.ts`, `scripts/generate-moon-map.ts`, `src/assets/moon-map.webp`       | create | drawn moon map                                                                 |
| `worker/where.ts`                                                                       | create | `/where`                                                                       |
| `worker/weather.ts`, `worker/weather.test.ts`                                           | delete |                                                                                |
| `worker/index.ts`, `worker/http.ts`, `wrangler.jsonc`, `public/_headers`                | modify | routes, CSP, Permissions-Policy                                                |
| `src/lib/i18n.ts`, `privacy-note.tsx`, `site-footer.astro`, footers of the pages        | modify | copy, credit, picker                                                           |
| `src/lib/sky-preset.ts`, `src/lib/theme.ts`, `package.json`, `src/styles/*.css`         | modify | drop `blogLook` and unused palettes, new tokens, `pnpm moon`, layer and bubble |
| `CLAUDE.md`, `docs/architecture.md`, `.claude/rules/sky.md`, `src/lib/blog/diagrams.ts` | modify | Part 6                                                                         |

---

## Part 1: Place and live weather (commit 1)

### Task 1: Place model

**Files:**

- Create: `src/lib/geo.ts`, `src/lib/sky-place.ts`, `src/lib/sky-place.test.ts`
- Modify: `src/lib/i18n.ts` (new `en.sky` group with `vienna: "Vienna"`, `coordinates: "{lat}° {ns}, {lon}° {ew}"`, `north: "N"`, `south: "S"`, `east: "E"`, `west: "W"`)

**Interfaces:**

- Produces:

```ts
// src/lib/geo.ts
export interface LatLon { lat: number; lon: number }
export const vienna: Readonly<LatLon>; // { lat: 48.2082, lon: 16.3738 }
export const roundPlace = (spot: LatLon): LatLon; // 0.1 degree, lat clamped to [-90, 90], lon wrapped to [-180, 180), never -0
export const distanceKm = (a: LatLon, b: LatLon): number; // haversine, radius 6371 km

// src/lib/sky-place.ts
export type PlaceKind = "vienna" | "visitor";
export interface SkyPlace extends LatLon { kind: PlaceKind; label: string }
export type PlaceStore = Pick<Storage, "getItem" | "removeItem" | "setItem">;
export const placeKey = "sky-place";
export const placeEvent = "sky:place";
export const viennaPlace: Readonly<SkyPlace>; // vienna, kind "vienna", label en.sky.vienna
export const coordinateLabel = (spot: LatLon): string;
export const placeOverride = (search: string): SkyPlace | undefined;
export const readPlace = (store?: PlaceStore): SkyPlace | undefined;
export const savePlace = (place: SkyPlace, store?: PlaceStore): void;
export const clearPlace = (store?: PlaceStore): void;
export const startPlace = (search: string, crawler: boolean, store?: PlaceStore): SkyPlace;
export const choosePlace = (place: SkyPlace | undefined, store?: PlaceStore, target?: EventTarget): void;
```

The default `store` is `globalThis.localStorage`, read inside `try` (`undefined` when it throws). The default `target` is `globalThis`. `choosePlace(place)` saves and dispatches `sky:place` with the place as `detail`; `choosePlace(undefined)` clears and dispatches `viennaPlace`.

- [ ] **Step 1: Write the failing tests** in `src/lib/sky-place.test.ts`:

```ts
it("rounds to 0.1 degree", () =>
  assert.deepEqual(roundPlace({ lat: 52.5163, lon: 13.3777 }), {
    lat: 52.5,
    lon: 13.4,
  }));
it("wraps the date line", () =>
  assert.deepEqual(roundPlace({ lat: 12.34, lon: 179.97 }), {
    lat: 12.3,
    lon: -180,
  }));
it("clamps the poles", () =>
  assert.equal(roundPlace({ lat: 95, lon: 0 }).lat, 90));
it("never gives -0", () =>
  assert.ok(Object.is(roundPlace({ lat: -0.04, lon: -0.04 }).lat, 0)));
it("measures Vienna to Berlin", () => {
  const km = distanceKm(vienna, { lat: 52.52, lon: 13.405 });
  assert.ok(km > 520 && km < 530);
});
it("labels coordinates", () => {
  assert.equal(coordinateLabel({ lat: 52.5, lon: 13.4 }), "52.5° N, 13.4° E");
  assert.equal(coordinateLabel({ lat: -33.9, lon: -70.7 }), "33.9° S, 70.7° W");
});
it("reads ?place=", () =>
  assert.deepEqual(placeOverride("?place=52.52,13.40"), {
    kind: "visitor",
    label: "52.5° N, 13.4° E",
    lat: 52.5,
    lon: 13.4,
  }));
it("ignores a broken ?place=", () => {
  assert.equal(placeOverride("?place=abc"), undefined);
  assert.equal(placeOverride("?place=91,0"), undefined);
});
```

Also, with a `Map`-backed `PlaceStore` and a store whose three methods throw:

- `it("round-trips a saved place")`: `savePlace` then `readPlace` gives the same `SkyPlace` with `kind` `"visitor"`; the stored JSON has exactly the keys `label`, `lat`, `lon`.
- `it("survives a throwing store")`: `readPlace` gives `undefined`; `savePlace` and `clearPlace` do not throw.
- `it("rejects junk")`: `"{"`, `{"lat":999,"lon":0,"label":"x"}`, a label of 81 characters and a number label all give `undefined`.
- `it("gives crawlers Vienna")`: `startPlace("?place=52.5,13.4", true, storeWithBerlin)` equals `viennaPlace`.
- `it("prefers ?place=, then the saved place, then Vienna")`.
- `it("saves and announces a place")`: an `EventTarget` gets one `sky:place` event with the place as `detail`; `choosePlace(undefined, store, target)` clears the store and sends `viennaPlace`.

- [ ] **Step 2: Run** `node --test src/lib/sky-place.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `geo.ts` and `sky-place.ts` as in Interfaces. `readPlace` accepts only a finite `lat` from -90 to 90, a `lon` from -180 to 180 and a string label of 1 to 80 characters, then rounds again. `coordinateLabel` uses `Math.abs(value).toFixed(1)` and the `en.sky` side letters.
- [ ] **Step 4: Run** the test again. Expected: PASS.

### Task 2: The sky math takes the place

**Files:**

- Modify: `src/lib/sky-sun.ts` (delete `viennaLatitude` and `viennaLongitude`), `src/lib/sky-paint.ts`, `src/lib/sky-sun.test.ts`, `src/lib/sky-paint.test.ts`, `src/components/space-background.tsx` (pass `viennaPlace` for now; Task 5 passes the live place)

**Interfaces:**

- Consumes: `LatLon`, `vienna` (Task 1).
- Produces: `sunSpot(instant: number, view: ViewSize, place: LatLon): Spot | undefined` and `paintScene(instant: number, view: ViewSize, weather: SkyWeather, place: LatLon): PaintScene`. Both pass `place.lat` and `place.lon` to `sunPosition` and `moonView`.

- [ ] **Step 1: Write the failing tests:**

```ts
const noon = Date.parse("2026-10-19T12:00:00+02:00");
it("puts the sun where the place sees it", () => {
  assert.ok(sunSpot(noon, view, vienna));
  assert.equal(sunSpot(noon, view, { lat: -33.9, lon: 151.2 }), undefined);
});
it("gives finite scenes far from Vienna", () => {
  const cases: Array<[LatLon, number]> = [
    [{ lat: -33.9, lon: 151.2 }, noon],
    [{ lat: 69.6, lon: 18.9 }, Date.parse("2026-12-21T12:00:00Z")],
    [{ lat: 69.6, lon: 18.9 }, Date.parse("2026-06-21T23:00:00Z")],
    [{ lat: 0, lon: -180 }, noon],
  ];
  for (const [place, instant] of cases)
    assert.ok(allFinite(paintScene(instant, view, fallbackWeather, place)));
});
```

`allFinite` is a small test helper that walks every number and array in the scene. Replace the Vienna constants in the existing tests with `vienna`.

- [ ] **Step 2: Run** `node --test src/lib/sky-sun.test.ts src/lib/sky-paint.test.ts`. Expected: FAIL on the Sydney assertion.
- [ ] **Step 3: Implement** the new signatures and update every caller.
- [ ] **Step 4: Run** the tests and `pnpm astro check`. Expected: PASS, 0 errors.

### Task 3: Weather mapping v2

**Files:**

- Modify: `src/lib/weather.ts`, `src/lib/weather.test.ts` (replace the tests of the old report shape)

**Interfaces:**

- Produces:

```ts
export interface WeatherReport {
  at: string; code: number; cover: number;
  coverHigh: number | undefined; coverLow: number | undefined; coverMid: number | undefined;
  humidity: number | undefined; precipitation: number; visibility: number | undefined;
  windFrom: number; windKmh: number;
}
export interface SkyWeather {
  alto: number; cirrus: number; cumulus: number; fog: number; haze: number; overcast: number;
  rain: number; snow: number; windFrom: number | undefined; windKmh: number;
}
export const parseReport = (body: unknown): WeatherReport | undefined; // the raw Open-Meteo answer
export const skyWeather = (report: WeatherReport): SkyWeather;
```

`weatherPresets`, `fallbackWeather` (still `partly`), `weatherOverride` and `windDrift` keep their names. `weatherPath` and `weatherEveryMs` stay until Task 5.

`parseReport` reads `body.current`: `time` (string), `weather_code`, `cloud_cover`, `wind_speed_10m`, `wind_direction_10m` must be finite numbers, else `undefined`. `cloud_cover_low`, `cloud_cover_mid`, `cloud_cover_high`, `visibility` and `relative_humidity_2m` may be `null` or missing (`undefined`). `precipitation` `null` or missing counts as 0.

Mapping rules (spec 4.2; Claude picked the ramp shapes):

- Layers: `cumulus = low / 100`, `alto = mid / 100`, `cirrus = high / 100`, each clamped to 0..1. When all three are missing: `cumulus = cover / 100`, `alto = cirrus = 0`.
- Deck: `overcast = max(deck, rain > 0 ? 0.88 : 0, snow > 0 ? 0.8 : 0, fog > 0 ? 0.25 : 0)` with `deck = cumulus + alto > 0.85 ? 0.92 : 0`. Code 3 alone no longer adds the deck.
- Haze: `visTerm` is 0.8 above 40 km, 1 from 20 to 40 km, and below 20 km linear from 1 to 2.5 at 2 km and below. `humTerm` is 0 under 70%, then linear from 1 at 70% to 2.5 at 95% and above. `haze = max(visTerm, humTerm)`. Missing visibility counts as 24 km, missing humidity as 60%.
- Rain: snow codes (71 to 77, 85, 86) give 0. Else `max(amount, floor)`: `amount` is 0 without precipitation, else `clamp(0.3 + 0.7 * (mm - 0.1) / 0.9, 0.3, 1)`; `floor` is 0.3 for 51 to 57, 0.6 for 61 to 67 and 80 to 82, 1 for 95 to 99, else 0.
- Fog: codes 45 and 48, or visibility under 1000 m. Snow and wind: as today.

Presets (`windKmh` 14, `windFrom` undefined, the rest 0):

| Preset   | cumulus | alto | cirrus | overcast | rain | snow | fog | haze |
| -------- | ------- | ---- | ------ | -------- | ---- | ---- | --- | ---- |
| clear    | 0.12    | 0    | 0.1    | 0        | 0    | 0    | 0   | 0.9  |
| partly   | 0.5     | 0.25 | 0.3    | 0        | 0    | 0    | 0   | 1    |
| overcast | 0.75    | 0.6  | 0.2    | 0.92     | 0    | 0    | 0   | 1.3  |
| rain     | 0.8     | 0.6  | 0.1    | 0.88     | 1    | 0    | 0   | 1.8  |
| snow     | 0.7     | 0.5  | 0.1    | 0.8      | 0    | 1    | 0   | 1.6  |
| fog      | 0.35    | 0    | 0      | 0.25     | 0    | 0    | 1   | 2.5  |

- [ ] **Step 1: Write the failing tests.** The base body is the live answer of 2026-10-19 19:15:

```ts
const body = (current: Record<string, unknown> = {}): unknown => ({
  current: {
    time: "2026-10-19T19:15",
    interval: 900,
    weather_code: 3,
    cloud_cover: 100,
    cloud_cover_low: 0,
    cloud_cover_mid: 0,
    cloud_cover_high: 100,
    wind_speed_10m: 9.4,
    wind_direction_10m: 290,
    visibility: 24140,
    relative_humidity_2m: 66,
    precipitation: 0,
    ...current,
  },
});
const sky = (current: Record<string, unknown> = {}): SkyWeather => {
  const report = parseReport(body(current));
  assert.ok(report);
  return skyWeather(report);
};
it("paints an all-high sky as a veil, not a deck", () => {
  const w = sky();
  assert.deepEqual([w.overcast, w.cirrus, w.cumulus, w.alto], [0, 1, 0, 0]);
});
it("adds the deck when low plus mid pass 85%", () =>
  assert.equal(
    sky({ cloud_cover_low: 60, cloud_cover_mid: 30 }).overcast,
    0.92
  ));
it("falls back to total cover without layers", () => {
  const w = sky({
    cloud_cover: 70,
    cloud_cover_low: null,
    cloud_cover_mid: null,
    cloud_cover_high: null,
  });
  assert.deepEqual([w.cumulus, w.alto, w.cirrus], [0.7, 0, 0]);
});
it("clamps covers", () => {
  assert.equal(sky({ cloud_cover_low: 120 }).cumulus, 1);
  assert.equal(sky({ cloud_cover_low: -5 }).cumulus, 0);
});
it("sees fog in codes and low visibility", () => {
  assert.equal(sky({ weather_code: 45 }).fog, 1);
  assert.equal(sky({ visibility: 800 }).fog, 1);
  assert.equal(sky({ visibility: 1000 }).fog, 0);
});
it("rejects bodies without the core fields", () => {
  for (const bad of [
    "<html>",
    {},
    { current: {} },
    body({ weather_code: null }),
    body({ time: 5 }),
    body({ wind_speed_10m: null }),
  ]) {
    assert.equal(parseReport(bad), undefined);
  }
});
```

Also, each as a loop over its cases with a tolerance of 1e-9:

- `it("maps haze")`: `sky({ visibility, relative_humidity_2m })` gives `haze` for (visibility m, humidity %, haze): (30000, 50, 1), (50000, 50, 0.8), (50000, 80, 1.6), (11000, 50, 1.75), (2000, 50, 2.5), (500, 50, 2.5), (30000, 82.5, 1.75), (30000, 95, 2.5), (null, null, 1).
- `it("maps rain strength")`: `sky({ weather_code, precipitation })` gives `rain` for (code, mm, rain): (3, 0, 0), (3, 0.1, 0.3), (3, 0.55, 0.65), (3, 1, 1), (3, 4, 1), (51, 0, 0.3), (61, 0, 0.6), (95, 0, 1), (71, 2, 0), (3, null, 0).
- `it("fills every preset")`: each preset has all ten keys and finite numbers (`windFrom` may be `undefined`), and `weatherOverride("?weather=fog")` equals the fog row.

- [ ] **Step 2: Run** `node --test src/lib/weather.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the rules above. Keep the parser hand-written (no zod in the browser bundle).
- [ ] **Step 4: Run** the test. Expected: PASS.

### Task 4: Browser weather client

**Files:**

- Create: `src/lib/weather-client.ts`, `src/lib/weather-client.test.ts`

**Interfaces:**

- Consumes: `LatLon`, `roundPlace` (Task 1); `parseReport`, `WeatherReport` (Task 3).
- Produces:

```ts
export const weatherStaleMs = 1_800_000; // the cache age, 900_000 ms, stays a module constant

export const weatherUrl = (place: LatLon): string;
export interface WeatherDeps {
  fetch: (url: string, init: { signal: AbortSignal }) => Promise<Response>;
  now: () => number;
  store: Pick<Storage, "getItem" | "setItem"> | undefined;
  timeoutMs?: number; // default 8000
}
export const loadWeather = (place: LatLon, deps: WeatherDeps): Promise<WeatherReport | undefined>;
export const samePlace = (a: LatLon, b: LatLon): boolean; // equal after roundPlace
export const weatherAllowed = (flags: { crawler: boolean; lightLoad: boolean; pinned: boolean }): boolean;
```

The URL uses the rounded place. Cache key `sky-weather:<lat>,<lon>` of the rounded place, value `{"at":<ms>,"body":<raw answer>}`; a hit younger than 15 min goes through `parseReport` again. One request per rounded place at a time: a second call while one runs gets the same promise. Any failure (network, abort, non-2xx, bad JSON, `parseReport` gives `undefined`) resolves `undefined`.

- [ ] **Step 1: Write the failing tests:**

```ts
it("builds the request", () =>
  assert.equal(
    weatherUrl(vienna),
    "https://api.open-meteo.com/v1/forecast?latitude=48.2&longitude=16.4&current=cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,weather_code,wind_speed_10m,wind_direction_10m,visibility,relative_humidity_2m,precipitation"
  ));
```

With a fake `fetch` that counts calls and returns `new Response(JSON.stringify(sampleBody))`:

- `it("uses a cache entry younger than 15 minutes")`: entry `at` = now minus 14 min, `fetch` is never called, the report comes back.
- `it("asks again after 15 minutes")`: entry `at` = now minus 16 min, `fetch` is called once and the entry is rewritten.
- `it("ignores a junk cache entry")` and `it("survives a throwing store")`: one request, a report comes back.
- `it("shares one request per place")`: two calls before the first resolves give one `fetch` call and equal reports.
- `it("gives undefined on a 429, an HTML page and a timeout")`: the timeout case uses a `fetch` that waits for the abort and `timeoutMs` 20.
- `it("knows the same place")`: `samePlace(vienna, { lat: 48.21, lon: 16.37 })` is true, Vienna and Berlin is false.
- `it("lets only live visitors ask")`: `weatherAllowed` is true only when all three flags are false.

- [ ] **Step 2: Run** `node --test src/lib/weather-client.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** with an `AbortController` per request and a timer of `timeoutMs`.
- [ ] **Step 4: Run** the test. Expected: PASS.

### Task 5: Wire place and weather into the sky; delete the Worker weather route

**Files:**

- Modify: `src/components/space-background.tsx`, `src/lib/sky-paint.ts`, `src/lib/sky-paint.test.ts`, `src/lib/sky-paint-shader.ts`, `src/lib/weather.ts` (delete `weatherPath` and `weatherEveryMs`), `public/_headers`, `worker/index.ts`, `wrangler.jsonc`, `src/lib/i18n.ts`, `src/components/privacy-note.tsx`
- Delete: `worker/weather.ts`, `worker/weather.test.ts`

**Interfaces:**

- Consumes: Tasks 1 to 4.
- Produces: `PaintScene` loses `cover` and gains `alto`, `cirrus`, `cumulus` and `haze`. Shader uniforms `u_cumulus`, `u_alto` and `u_cirrus` replace `u_cover` (`u_mid` is taken: it is a sky color). At runtime the sky holds `place = startPlace(location.search, crawler)` and listens to `sky:place` on `window`.

- [ ] **Step 1: Write the failing test** in `sky-paint.test.ts`: `it("passes the cloud layers through")`: `paintScene` with `{ ...fallbackWeather, alto: 0.4, cirrus: 0.9, cumulus: 0.2, haze: 1.6 }` gives those four values on the scene.
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Implement the scene and the shaders.**
  - Scene: carry the four fields, delete `cover`.
  - `shapeAt` spawn rule: `u_cover` becomes `u_cumulus`.
  - `cirrusLayer`: amount `(0.15 + 0.85 * u_cirrus)` and nothing when `u_cirrus` is under 0.02; plus a veil `0.18 * smoothstep(0.7, 1.0, u_cirrus) * smoothstep(0.3, 0.8, yb)`; total alpha at most 0.35, times `(1.0 - u_ov)`. Stars and the moon stay visible through it.
  - New `altoLayer(fc)` for the mid layer: one fbm field of small cells (about 7 cells across one screen height, 11 rows per screen height), only above 25% of the height, made patchy by a slow fbm, lit between `u_shade` and `u_lit` plus `u_sunCol * u_glow * 0.12`, alpha at most `0.55 * u_alto * (1.0 - u_ov)`, drift `u_wind * 0.012`. Order in `main`: overcast, glaze (cumulus), alto, cirrus.
- [ ] **Step 4: Implement the runtime** in `space-background.tsx`:
  - `WeatherKey` is `"alto" | "cirrus" | "cumulus" | "fog" | "haze" | "overcast" | "rain" | "snow" | "windKmh"`, and the ease covers all of them.
  - Delete `fetchReport`, `weatherTimer`, the `setInterval`, the `weatherEveryMs` and `weatherPath` imports and the `import.meta.env.DEV` gate (the browser reaches Open-Meteo in dev too).
  - After the first frame, in every mode: when `weatherAllowed({ crawler, lightLoad: prefersLightLoad(), pinned: weatherFixed !== undefined })`, call `loadWeather(place, { fetch, now: Date.now, store })` with a guarded `sessionStorage`. Drop the answer when `!samePlace(asked, place)`, else `skyWeather` and ease as today. Keep `weatherAt`.
  - `visibilitychange` to visible: load again when `Date.now() - weatherAt >= weatherStaleMs`.
  - `sky:place`: set `place`, refresh the scene, load the weather.
  - A `ClientRouter` swap does not ask again (the island persists; today's load on swap to home goes).
  - `uploadScene` sends `u_cumulus`, `u_alto`, `u_cirrus`. The cloud pass is skipped when all three layers are under `cloudCoverMin` and there is no overcast.
- [ ] **Step 5: Remove the Worker route and open the CSP.**
  - Delete `worker/weather.ts` and its test. `worker/index.ts` routes `/mcp`, else `env.ASSETS.fetch(request)`.
  - `wrangler.jsonc`: `"run_worker_first": ["/mcp", "/mcp/*"]` (Task 16 adds `/where`).
  - `public/_headers`: `connect-src 'self' https://cloudflareinsights.com https://api.open-meteo.com`.
  - `en.privacy.weather`: "Your browser asks Open-Meteo for the weather, so Open-Meteo sees your IP address." `privacy-note.tsx` renders it after `host`.
- [ ] **Step 6: Run** `pnpm fix`, then `node --test "scripts/**/*.test.ts" "src/**/*.test.ts" "worker/**/*.test.ts"`, `pnpm astro check` and `pnpm exec tsc --noEmit -p worker/tsconfig.json`. Expected: all pass.
- [ ] **Step 7: Check in a browser** (`pnpm dev`, headless Playwright): `/?place=52.5,13.4` makes one request to `api.open-meteo.com` with `latitude=52.5&longitude=13.4`; a reload within 15 min makes none; `/?weather=rain` makes none and shows rain.
- [ ] **Step 8: Commit** (background):

```bash
git add src/lib/geo.ts src/lib/sky-place.ts src/lib/sky-place.test.ts src/lib/weather.ts src/lib/weather.test.ts src/lib/weather-client.ts src/lib/weather-client.test.ts src/lib/sky-sun.ts src/lib/sky-sun.test.ts src/lib/sky-paint.ts src/lib/sky-paint.test.ts src/lib/sky-paint-shader.ts src/lib/i18n.ts src/components/space-background.tsx src/components/privacy-note.tsx public/_headers worker/index.ts wrangler.jsonc
git rm worker/weather.ts worker/weather.test.ts
git commit -m "feat(sky): visitor place and live weather in the browser"
```

Expected: the hook ends with "Meta guard passed" and exit 0.

---

## Part 2: Real light, wider view, no skyline (commit 2)

### Task 6: Sky light table

**Files:**

- Create: `src/lib/sky-light.ts` (port of `_ref/sky-rework/scatter.ts`), `src/lib/sky-light.test.ts`

**Interfaces:**

- Produces:

```ts
export interface ScatterInput { /* as in scatter.ts */ }
export interface ScatterOutput { /* as in scatter.ts */ }
export const scatterSky = (input: ScatterInput): ScatterOutput; // ported unchanged
export const lutCols = 72;
export const lutRows = 44;
export interface TableInput {
  center: number; haze: number; view: ViewSize;
  moon: { altitude: number; azimuth: number; fraction: number };
  sun: { altitude: number; azimuth: number };
}
export interface SkyTable {
  lit: readonly [number, number, number]; low: readonly [number, number, number];
  mid: readonly [number, number, number]; pixels: Uint8Array;
  shade: readonly [number, number, number]; sunColor: readonly [number, number, number];
  top: readonly [number, number, number];
}
export const skyTable = (input: TableInput): SkyTable;
```

`skyTable` calls `scatterSky` with `adapt` 0.28, `blueHour` 1, `multi` 0.6, `haze` 1.2 x `input.haze`, sun power 1, moon power `2.5e-6 * fraction ** 1.5`, the night colors from `paintPalettes.night`, and the view `{ center, height, horizon: horizonHeight(height), ppd: pixelsPerDegree(height), width }`. It derives `low`, `mid` and `top` as row means at 0.05, 0.45 and 0.96 of the height, `lit = display(ambientLinear * 0.7 + cloudLight)`, `shade = display(ambientLinear * 0.45)` and `sunColor`, as in `_ref/sky-rework/preview.ts` lines 200 to 236. `sky-light.ts` must not import from `sky-paint.ts` (knip `cycles`).

- [ ] **Step 1: Write the failing tests.** Reference numbers from the prototype run on 2026-10-19: +6 degrees mid 125,155,195 and low 255,203,150; -3 degrees mid 99,90,130 and low 255,163,116; -8 degrees mid 36,38,63 (luminance 0.021) and top 24,27,44 (0.012).

```ts
const frame = (altitude: number): ScatterOutput =>
  scatterSky({
    adapt: 0.28,
    blueHour: 1,
    cols: 72,
    haze: 1.2,
    multi: 0.6,
    rows: 44,
    moon: { altitude: -30, azimuth: 0, power: 0 },
    night: { low: unit(night.low), mid: unit(night.mid), top: unit(night.top) },
    sun: { altitude, azimuth: 255, power: 1 },
    view: { center: 255, height: 900, horizon: 18, ppd: 9.8, width: 1440 },
  });
it("paints a blue sky over a golden horizon at +6 degrees", () => {
  const f = frame(6);
  const [mr, , mb] = at(f, 0.45, 0.5);
  assert.ok(mb > mr + 40);
  const [lr, , lb] = at(f, 0.03, 0.5);
  assert.ok(lr > lb + 60);
});
it("turns violet over a red band at -3 degrees", () => {
  const f = frame(-3);
  const [r, g, b] = at(f, 0.45, 0.5);
  assert.ok(b > r && b > g);
  const [lr, lg, lb] = at(f, 0.03, 0.5);
  assert.ok(lr > lg && lg > lb);
});
it("has no yellow above 10% of the height at -3 degrees", () => {
  for (const [r, g, b] of pixelsAbove(frame(-3), 0.1))
    assert.ok(!(r > 120 && g > 0.75 * r && b < 0.7 * g));
});
it("is deep navy at -8 degrees", () => {
  for (const yb of [0.45, 0.9]) {
    const [r, g, b] = at(frame(-8), yb, 0.5);
    assert.ok(b > r && b > g && luminance(r, g, b) < 0.03);
  }
});
```

`unit` maps a theme hex to 0..1 with `hexBytes`; `at` reads row `floor(yb * 44)` and column `floor(xb * 72)`; `pixelsAbove` yields the pixels whose row center `(row + 0.5) / 44` is at least the share; `luminance` comes from `sky-ink.ts` (byte input). Also `it("builds a 72 by 44 table with colors in range")`: `skyTable(...)` has `pixels.length` 12672 and every derived color channel from 0 to 1.

- [ ] **Step 2: Run** `node --test src/lib/sky-light.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the port and `skyTable`.
- [ ] **Step 4: Run** the test. Expected: PASS.

### Task 7: Wider view, space band, star gate

**Files:**

- Modify: `src/lib/sky-view.ts`, `src/lib/sky-paint.ts`, `src/lib/sky-paint-shader.ts`, `src/lib/theme.ts` (`paintTints.space` `#04060E`), `src/components/space-background.tsx`, and the tests that pin the old view numbers (`sky-view`, `sky-sun`, `sky-paint`, `sky-tween`): recompute their expected values, do not loosen them.

**Interfaces:**

- Produces: `sky-view.ts` constants `viewDegrees` 90, `viewShare` 0.98, `horizonShare` 0.02. In `sky-paint.ts`: `spaceBand = 0.14` and `starShare(sunAltitude: number): number` (0 at -1 degree, 1 at -9 degrees, linear). Uniforms `u_band`, `u_space`, `u_starGate`.

- [ ] **Step 1: Write the failing tests:**

```ts
it("puts the horizon at 2% and the zenith on the top edge", () => {
  assert.equal(horizonHeight(900), 18);
  assert.ok(Math.abs(pixelsPerDegree(900) - 9.8) < 1e-9);
  const top = projectSight({ altitude: 90, azimuth: 200 }, 200, {
    height: 900,
    width: 1440,
  });
  assert.ok(Math.abs(top.y - 900) < 1e-6);
});
it("lets stars in from -1 to -9 degrees", () => {
  assert.deepEqual(
    [
      starShare(10),
      starShare(-1),
      starShare(-5),
      starShare(-9),
      starShare(-20),
    ],
    [0, 0, 0.5, 1, 1]
  );
});
```

- [ ] **Step 2: Run** `node --test src/lib/sky-view.test.ts src/lib/sky-paint.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `scene.stars = starShare(sun.altitude) * (1 - overcast) * (1 - 0.35 * moonShare * fraction)`.
  - `skyAt` mixes `u_space` over the top `u_band` share with the prototype `bandMask` (`smoothstep(1.0 - u_band, 1.0 + u_band * 0.2, yb)`), in both programs.
  - Stars, as the prototype patch: `starAmt = u_stars * smoothstep(0.02, 0.35, yb)`, then `starAmt *= 1.0 - u_starGate * smoothstep(0.03, 0.2, dot(sky, luma))`, then `starAmt = max(starAmt, bandMask(fc) * 0.95)`. `u_starGate` is 1.
- [ ] **Step 4: Run** all sky tests. Expected: PASS.

### Task 8: The table in the shaders; drop the clock palettes

**Files:**

- Modify: `src/lib/sky-paint.ts`, `src/lib/sky-paint.test.ts`, `src/lib/sky-paint-shader.ts`, `src/components/space-background.tsx`, `src/lib/theme.ts`

**Interfaces:**

- Consumes: `skyTable`, `TableInput`, `SkyTable` (Task 6).
- Produces:
  - `tableInput(instant: number, view: ViewSize, weather: SkyWeather, place: LatLon): TableInput`, sharing one internal aim function with `paintScene`.
  - `paintScene(instant, view, weather, place, table?: SkyTable): PaintScene`.
  - `PaintScene` gains `lutMix: number` and `grey: number`.
  - Uniforms `u_lut` (unit 2), `u_lutMix`, `u_grey`, in both programs.

With a table: `low`, `mid`, `top` and `sunColor` come from the table; `lit = mix(table.lit, night.lit, nightShare)` and `shade = mix(table.shade, night.shade, nightShare)` with `nightShare = 1 - smoothstep(-16, -6, sunAltitude)`; then today's rain palette mix by `overcast * 0.8`; `glow = 0.3 * smoothstep(-4, 2, sunAltitude) * (1 - 0.7 * overcast)`; `lutMix` 1; `grey = overcast * 0.8`. Without a table: the night palette and `lutMix` 0. `skyAt` becomes `mix(gradient, mix(texture2D(u_lut, fc / u_res).rgb, gradient, u_grey), u_lutMix)`, then the sun glow, the moon glow and the band.

- [ ] **Step 1: Write the failing tests:** `it("takes the colors from the table")` (a stub table with distinct colors, clear weather, the sun at +20 degrees: `low`, `mid`, `top` equal the table's) and `it("uses the night palette without a table")` (`lutMix` 0 and `top` equals the night palette top).
- [ ] **Step 2: Run** `node --test src/lib/sky-paint.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement the scene and the shaders.**
- [ ] **Step 4: Implement the runtime.** `refreshTable()` builds `skyTable(tableInput(...))`, uploads 72 x 44 RGBA to unit 2 (`LINEAR`, `CLAMP_TO_EDGE`) and refreshes the scene. Home mode only. The first build goes through `scheduleIdle(..., { fallbackMs: 0, timeout: 200 })` and the first home frame waits for it (it already waits for the program link). Refreshes (the 30 s tick, resize, place change, the start and the end of a weather ease) use `scheduleIdle(..., { fallbackMs: 50, timeout: 1000 })`.
- [ ] **Step 5: Delete** `clockPalette`, `mixPalette`, `paletteOf` if nothing uses them, and each `paintPalettes` entry that no code reads (`rg -n "paintPalettes\.|paletteOf\(" src scripts`). Keep `night`, `rain` and the tints in use.
- [ ] **Step 6: Measure the build.** `pnpm dev`, Playwright Chromium, CDP `Emulation.setCPUThrottlingRate` with `rate` 4, then in the page `const { skyTable } = await import("/src/lib/sky-light.ts")` and time 5 builds of a fixed input. Expected: median under 16 ms. If not: set `lutCols` 48 and `lutRows` 30 and measure again. If it is still over: stop and report.
- [ ] **Step 7: Look.** `?at=2026-10-19T15:16:00Z` (+6), `16:12:00Z` (-3), `16:42:00Z` (-8) and `09:30:00Z` (day) at 1440 x 900 against the C2 frames of the pick page. Expected: no yellow dusk.

### Task 9: Delete the skyline; mist by haze

**Files:**

- Modify: `src/lib/sky-paint-shader.ts`, `src/lib/sky-paint.ts`, `src/lib/sky-paint.test.ts`, `src/components/space-background.tsx`

- [ ] **Step 1: Write the failing test:**

```ts
it("has no skyline", () => {
  for (const name of [
    "skylineLayer",
    "cityLayer",
    "spire",
    "roofBand",
    "hillH",
  ])
    assert.ok(!paintSkyShader.includes(name));
});
```

- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Implement.** Delete `cityLayer`, `skylineLayer`, `sdBox`, `sdSeg`, `spire`, `hillH`, `roofBand`, the Riesenrad and `lineInk`. Delete `u_night` and `PaintScene.night` when nothing else reads them. Keep the `city` tint glow on low clouds. `mistLayer` alpha is multiplied by `u_haze` (from `scene.haze`) and capped at 0.85.
- [ ] **Step 4: Run** `pnpm fix`, all tests and `pnpm astro check`. Expected: PASS.
- [ ] **Step 5: Commit** (background): `feat(sky): physical sky light, wider view and no skyline`, with the Part 2 paths.

---

## Part 3: The moon (commit 3)

### Task 10: Moon map

**Files:**

- Create: `scripts/moon-map.ts` (port of `_ref/sky-rework/moon-map.ts`, same math), `scripts/generate-moon-map.ts`, `scripts/moon-map.test.ts`, `src/assets/moon-map.webp`
- Modify: `package.json` (`"moon": "node scripts/generate-moon-map.ts"`)

**Interfaces:**

- Produces:

```ts
// scripts/moon-map.ts
export const moonMapWidth = 512;
export const moonMapHeight = 256;
export const moonMapPath = "src/assets/moon-map.webp";
export const moonMap = (): Uint8Array; // RGBA 512 x 256: r albedo, g height, b mare, a 255; row 0 is latitude -90
export const stackMap = (rgba: Uint8Array): Uint8Array; // 1 channel, 512 x 512: rows 0 to 255 albedo (r), rows 256 to 511 height (g)
```

`generate-moon-map.ts` has no exports. It writes `sharp(stackMap(moonMap()), { raw: { channels: 1, height: 512, width: 512 } }).webp({ effort: 6, quality: 85 })` to `moonMapPath`. If the file is 60 KB or more, try quality 75; if it is still too big, stop and report.

- [ ] **Step 1: Write the failing tests:**

```ts
it("draws the same map every run", () =>
  assert.deepEqual(moonMap(), moonMap()));
it("stacks albedo over height", () => {
  const rgba = moonMap();
  const gray = stackMap(rgba);
  assert.equal(gray.length, 512 * 512);
  assert.equal(gray[0], rgba[0]);
  assert.equal(gray[512 * 256], rgba[1]);
});
it("keeps the committed map small", async () => {
  const meta = await sharp(moonMapPath).metadata();
  assert.deepEqual([meta.width, meta.height], [512, 512]);
  assert.ok(statSync(moonMapPath).size < 60_000);
});
```

- [ ] **Step 2: Run** `node --test scripts/moon-map.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the port and the generator, then run `pnpm moon`.
- [ ] **Step 4: Run** the test. Expected: PASS. Look at the image once (convert a copy to PNG in the scratchpad).

### Task 11: One moon GLSL chunk, size and air tint

**Files:**

- Create: `src/lib/sky-moon-shader.ts`
- Modify: `src/lib/sky-paint-shader.ts`, `src/lib/sky-paint.ts`, `src/lib/sky-paint.test.ts`, `src/lib/sky-moon.ts`, `src/lib/sky-moon.test.ts`, `src/components/space-background.tsx`

**Interfaces:**

- Produces:

```ts
// src/lib/sky-moon-shader.ts
export const moonShader: string;
// GLSL uniforms: u_moon (vec4 x, y, radius, visible), u_moonL, u_moonN, u_earth, u_moonCol, u_moonTint,
// u_aura, u_bump, u_moonMap (sampler), u_mapOn. Functions: vec3 moonFace(vec2 fc, out float cover), vec3 moonAura(vec2 fc).
// src/lib/sky-moon.ts
export const airTint = (altitude: number): readonly [number, number, number]; // port of airTint in preview.ts
// src/lib/sky-paint.ts: module constants moonScale = 1.85 and moonAura = 0.55 (not exported)
// PaintScene gains aura: number and moonTint: Rgb
```

- `moonFace` ports `moonDisk2` from `_ref/sky-rework/shaders.ts` for style 1 only (drop `u_moonStyle` and the painted branch). It reads the stacked map: albedo at `v * 0.5`, height at `0.5 + v * 0.5` (`UNPACK_FLIP_Y` off, `v = lat / PI + 0.5`), with `v` kept half a texel inside each half. With `u_mapOn` 0 it uses today's procedural albedo from `moonDisk`.
- `moonAura` ports `moonOptics` without the 22 degree halo (drop `u_halo` and `u_ppd`). `u_bump` is 0.035.
- The paint program: `moonFace` replaces `moonDisk`, `col += moonAura(fc)` after the moon. New `u_moonFace`: 1 adds the face; 0 (the moon layer runs, Task 12) keeps the sky and only hides the stars inside the disk. Until Task 12 it is 1.
- The map in the main context: unit 3, `u_mapOn` 1 once loaded. Load it after the first frame, only on home while `scene.moon[3] > 0`: `import moonMapUrl from "@/assets/moon-map.webp?url"`, `new Image()`, `decode()`, `texImage2D`, `LINEAR`, `CLAMP_TO_EDGE`, no mipmaps.
- Scene: the moon radius times `moonScale`, `aura` = `moonAura`, `moonTint` = `airTint(moon.altitude)`.

- [ ] **Step 1: Write the failing tests:**

```ts
it("draws the moon 1.85 times bigger", () => {
  const scene = paintScene(
    Date.parse("2026-11-20T16:50:00Z"),
    { height: 900, width: 1440 },
    weatherPresets.clear,
    vienna
  );
  const share = scene.moon[2] / 900;
  assert.ok(share > 0.043 && share < 0.054);
});
it("warms and dims the low moon", () => {
  assert.ok(airTint(60).every((c) => c > 0.9));
  const [r, g, b] = airTint(5);
  assert.ok(r > g && g > b);
});
```

- [ ] **Step 2: Run** `node --test src/lib/sky-paint.test.ts src/lib/sky-moon.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the chunk, the scene fields and the map load.
- [ ] **Step 4: Run** the tests and `pnpm astro check`. Expected: PASS. Look at `?at=2026-11-20T16:50:00Z` (gibbous) and `?at=2026-11-04T04:10:00Z` (crescent at dawn) against the A1 frames.

### Task 12: The sharp moon layer

**Files:**

- Create: `src/lib/moon-layer.ts`, `src/lib/moon-layer.test.ts`
- Modify: `src/components/space-background.tsx`, `src/styles/globals.css` (`.moon-layer`)

**Interfaces:**

- Consumes: `moonShader` (Task 11).
- Produces:

```ts
export interface PatchRect { size: number; x: number; y: number } // cloud texture px, origin bottom left
export const patchRect = (moon: { radius: number; x: number; y: number }, cloud: { height: number; width: number }, cloudPerCss: number): PatchRect;
// size = min(64, 2 * ceil(radius * cloudPerCss)), centered on the moon, kept inside the texture
export const layerPixels = (radius: number, dpr: number): { css: number; device: number };
// css = ceil(2.2 * radius), device = round(css * min(dpr, 2))
export interface MoonLayerState {
  cloud: { data: Uint8Array; size: number } | undefined;
  color: Rgb; earth: number; fade: number; light: Rgb; north: readonly [number, number];
  radius: number; tint: Rgb; x: number; y: number; // CSS px from the top left of the viewport
}
export interface MoonLayer { dispose: () => void; draw: (state: MoonLayerState) => void }
export const createMoonLayer = (host: HTMLElement, map: TexImageSource): MoonLayer | undefined;
```

- The canvas has `aria-hidden="true"` and class `moon-layer`, inside the sky wrapper after the main canvas. CSS: `position: absolute; left: 0; top: 0; pointer-events: none; mix-blend-mode: plus-lighter;` and `@supports not (mix-blend-mode: plus-lighter)` gives `screen`. It moves with `transform: translate3d(...)`; `opacity` is the moon fade.
- Context `webgl` with `{ alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: "low-power" }`. One full-screen triangle with `moonShader`: the map on unit 0, the cloud patch on unit 1, `u_mapOn` 1. Output premultiplied: color `face * (1 - cloudAlpha)`, alpha `cover * (1 - cloudAlpha)`.
- In the main context, `drawClouds` reads the patch before it renders the new cloud frame (so the read is one cloud frame late): bind the cloud framebuffer, `readPixels` the `patchRect`, then render. The spec's 32 x 32 is the size on a 900 px tall screen; taller screens read up to 64 x 64 so the patch still covers the disk.
- The layer draws after each cloud frame, on scene refresh and on resize; one draw for a still sky or reduced motion. It starts after the map loads while the moon is on screen; when it fails, `u_moonFace` stays 1. While it runs, `u_moonFace` is 0. Blog mode hides it and stops its draws.

- [ ] **Step 1: Write the failing tests:**

```ts
it("reads a 32 px patch on a 900 px screen", () =>
  assert.equal(
    patchRect(
      { radius: 42.3, x: 1000, y: 700 },
      { height: 338, width: 540 },
      0.375
    ).size,
    32
  ));
it("caps the patch at 64 px", () =>
  assert.equal(
    patchRect(
      { radius: 200, x: 500, y: 500 },
      { height: 600, width: 1000 },
      0.375
    ).size,
    64
  ));
it("keeps the patch inside the texture", () =>
  assert.equal(
    patchRect(
      { radius: 42.3, x: 5, y: 700 },
      { height: 338, width: 540 },
      0.375
    ).x,
    0
  ));
it("caps the layer at 2x density", () =>
  assert.deepEqual(layerPixels(42.3, 3), { css: 94, device: 188 }));
```

- [ ] **Step 2: Run** `node --test src/lib/moon-layer.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the helpers, the layer and the wiring.
- [ ] **Step 4: Run** the tests, `pnpm fix` and `pnpm astro check`. Expected: PASS.
- [ ] **Step 5: Measure.** Chrome trace at `deviceScaleFactor` 2 on `?at=2026-11-20T16:50:00Z`, the layer on and off. Expected: under 0.3 ms GPU per frame more with the layer. Check the cloud-over-moon look with `?weather=partly`.
- [ ] **Step 6: Commit** (background): `feat(sky): real moon map and sharp moon layer`, with the Part 3 paths, `package.json` and `src/assets/moon-map.webp`.

---

## Part 4: Painted night on the other pages (commit 4)

### Task 13: Night look and scene mix

**Files:**

- Modify: `src/lib/sky-paint.ts`, `src/lib/sky-paint.test.ts`, `src/lib/theme.ts` (`paintTints.corona` `#FFE6C4`)

**Interfaces:**

- Produces:

```ts
export const coronaSpot = (view: ViewSize): { x: number; y: number }; // (-0.08 * width, 1.12 * height), paint px, y up (the D2 frame)
export const nightScene = (view: ViewSize, weather: SkyWeather): PaintScene;
export const mixScene = (from: PaintScene, to: PaintScene, t: number): PaintScene; // linear in every number and color
// PaintScene gains corona: readonly [number, number, number] (x, y, strength); home scenes have strength 0
```

`nightScene`: the night palette, `lutMix` 0, `stars = 1 - overcast`, no sun (`sunUp` 0, `glow` 0, sun radius 0), no moon (`moon[3]` 0, `moonGlow` 0), `rain`, `snow` and `fog` 0, the cloud layers, overcast and haze from the weather, `drift = windDrift(windKmh, windFrom, 180)`, `light` at `coronaSpot`, `lightColor` the corona tint, `lit = mix(night.lit, corona, 0.25)`, `corona = [x, y, 1]`.

- [ ] **Step 1: Write the failing tests:**
  - `it("draws the night look with live clouds")`: `nightScene(view, { ...fallbackWeather, cumulus: 0.6 })` has `cumulus` 0.6, `moon[3]` 0, `sunUp` 0, `rain` 0, `lutMix` 0, `corona[2]` 1, `corona[0] < 0` and `corona[1] > view.height`.
  - `it("mixes scenes end to end")`: `mixScene(a, b, 0)` deep-equals `a`, `mixScene(a, b, 1)` deep-equals `b`, and at 0.5 `stars` is the mean.
- [ ] **Step 2: Run** `node --test src/lib/sky-paint.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the test. Expected: PASS.

### Task 14: Corona and meteor in the paint program; one program for every page

**Files:**

- Modify: `src/lib/sky-paint-shader.ts`, `src/components/space-background.tsx`, `src/lib/sky-preset.ts`, `src/lib/sky-preset.test.ts`

**Interfaces:**

- Consumes: `nightScene`, `mixScene`, `coronaSpot` (Task 13); `tweenPose`, `easeInOut` (`sky-tween.ts`, unchanged); `cornerMeteor` (`sky-rays.ts`).
- Produces: uniforms `u_corona` (vec3), `u_coronaCol`, `u_meteor` (vec4), `u_meteorScale`. `Programs` is `{ cloud, paint }`.

- [ ] **Step 1: Port the GLSL.**
  - Corona: `coronaLayer` from `_ref/sky-rework/shaders.ts` on `u_corona` and `u_coronaCol`, added after the moon aura and before the clouds. This is the port branch of spec 4.7: the D2 frame was drawn by this prototype function, not by the `sky-rays.ts` corona, so sharing `sky-rays.ts` would not match D2.
  - Meteor: the meteor block of `src/lib/sky-shader.ts` (`u_meteor`, `meteorTail`, `meteorTravel`, `meteorWidth`, lines 440 to 452). Its lengths were in blog view units (`u_view`); pass that view height in paint px as `u_meteorScale` so the look stays. Positions still come from `cornerMeteor`: 1.6 s every 6 s, only while the sky runs, never for crawlers.
- [ ] **Step 2: One program.** Delete the blog program, `drawBlog`, the puffs, the pointer tilt, the `blogLook` use and the `longRaysShader` import. Blog mode draws the paint program with `nightScene`; the probe uses the paint sink in both modes. The swipe gust adds to `windPos` (the clouds speed up) in place of `shiftMs`. Crawlers and Save-Data still get one still frame of the painted night.
- [ ] **Step 3: The shot.** One paint draw per frame: `scene = mixScene(home, night, e)` with `e = easeInOut(progress)` (the reverse runs the other way). Then the sun and the corona from `tweenPose` (convert its CSS frame, y down, to paint px, y up): the sun at `pose.source` with visibility times `pose.disk`, the corona at `pose.source` (or `coronaSpot` when there is none) with strength `e`. The moon and the moon layer fade by `1 - e`. The table stays bound and `lutMix` eases with the mix. `?tween=` holds as today.
- [ ] **Step 4: Clean up.** `sky-preset.ts`: delete `blogLook` and every type only it used; keep `imageClouds`, `nightPhase` and `SkyMode` for `scripts/generate-images.ts`. Drop the `blogLook` cases in `sky-preset.test.ts`. `sky-rays.ts` keeps `longRaysShader` for the social images.
- [ ] **Step 5: Run** `pnpm fix`, all tests, `pnpm astro check` and `pnpm exec knip`. Expected: all clean.
- [ ] **Step 6: Look and measure.** `/blog`, `/work` and `/about` at 1440 x 900 and 390 x 844 against the D2 frame; `/?tween=0.5`; the blog body text keeps at least 9.9:1 over the fade layer. `site-probe.mjs` on `/blog`, throttled: no new long tasks at start.

### Task 15: Footer credit on every live page

**Files:**

- Modify: `src/components/blog/blog-index.astro`, `src/pages/blog/[slug].astro`, `src/pages/work.astro`, `src/pages/about.astro`, `src/pages/404.astro` (it uses `BlogLayout` and draws the home sky): `<SiteFooter className="blog-footer" links rss weather />`

- [ ] **Step 1: Build and check:** `pnpm build`, then `rg -c "open-meteo.com" dist/blog.html dist/work.html dist/about.html dist/404.html`. Expected: each at least 1.
- [ ] **Step 2: Commit** (background): `feat(sky): painted night with corona rays on blog, work and about`, with the Part 4 paths.

---

## Part 5: Bubble, picker and /where (commit 5)

### Task 16: Worker /where

**Files:**

- Create: `worker/where.ts`, `worker/where.test.ts`
- Modify: `worker/index.ts`, `wrangler.jsonc` (`"run_worker_first": ["/mcp", "/mcp/*", "/where"]`), `worker/http.ts` and `public/_headers` (`Permissions-Policy: camera=(), microphone=(), geolocation=(self)`, the two lists stay equal)

**Interfaces:**

- Consumes: `vienna`, `roundPlace`, `distanceKm` from `src/lib/geo.ts` (not `sky-place.ts`, which pulls in i18n); `withSecurityHeaders`, `failure` from `worker/http.ts`.
- Produces:

```ts
export const wherePath = "/where";
export interface WhereAnswer { city: string | null; far: boolean | null; lat: number | null; lon: number | null }
export interface WhereCf { city?: string; latitude?: string; longitude?: string }
export const whereAnswer = (cf: WhereCf | undefined): WhereAnswer;
export const handleWhere = (request: Request, cf: WhereCf | undefined): Response;
```

Rules: `latitude` and `longitude` go through `Number.parseFloat`, must be finite and in range, then `roundPlace`; else `lat`, `lon` and `far` are `null`. `city` is the trimmed string or `null`. `far` is `distanceKm(spot, vienna) > farKm`, with `farKm = 100` a module constant in `where.ts`. GET and HEAD get 200 JSON with `Cache-Control: private, no-store`, `X-Robots-Tag: noindex` and `withSecurityHeaders`. Other methods get `failure(405, "Method not allowed", { Allow: "GET, HEAD" })`. No logging, no upstream fetch. `worker/index.ts` passes `request.cf`.

- [ ] **Step 1: Write the failing tests:**

```ts
it("answers Berlin as far", () =>
  assert.deepEqual(
    whereAnswer({
      city: "Berlin",
      latitude: "52.52000",
      longitude: "13.40500",
    }),
    { city: "Berlin", far: true, lat: 52.5, lon: 13.4 }
  ));
it("answers a Vienna suburb as near", () =>
  assert.equal(
    whereAnswer({ city: "Schwechat", latitude: "48.14", longitude: "16.48" })
      .far,
    false
  ));
it("answers nulls without data", () =>
  assert.deepEqual(whereAnswer(undefined), {
    city: null,
    far: null,
    lat: null,
    lon: null,
  }));
it("keeps the city with a broken spot", () =>
  assert.deepEqual(
    whereAnswer({ city: "Graz", latitude: "abc", longitude: "15.4" }),
    { city: "Graz", far: null, lat: null, lon: null }
  ));
it("sends private, noindex headers", () => {
  const response = handleWhere(
    new Request("https://stevanpavlovic.com/where"),
    { city: "Berlin", latitude: "52.52", longitude: "13.4" }
  );
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex");
});
it("refuses POST", () => {
  const response = handleWhere(
    new Request("https://stevanpavlovic.com/where", { method: "POST" }),
    undefined
  );
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "GET, HEAD");
});
it("keeps one Permissions-Policy", () => {
  const line = readFileSync("public/_headers", "utf8")
    .split("\n")
    .find((row) => row.trim().startsWith("Permissions-Policy:"));
  assert.equal(
    line?.split(": ")[1],
    withSecurityHeaders(new Response()).headers.get("Permissions-Policy")
  );
  assert.match(line ?? "", /geolocation=\(self\)/);
});
```

- [ ] **Step 2: Run** `node --test worker/where.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the route, the router line, `run_worker_first` and both header lists.
- [ ] **Step 4: Run** the test and `pnpm exec tsc --noEmit -p worker/tsconfig.json`. Expected: PASS.

### Task 17: Bubble rules, location prompt and weather words

**Files:**

- Create: `src/lib/sky-ask.ts`, `src/lib/sky-ask.test.ts`
- Modify: `src/lib/weather.ts`, `src/lib/weather.test.ts`, `src/lib/i18n.ts`

**Interfaces:**

- Consumes: `LatLon`, `roundPlace` (Task 1); `coordinateLabel` (Task 1).
- Produces:

```ts
// src/lib/sky-ask.ts
export const askedKey = "sky-place-asked";
export const spotEvent = "sky:spot";
export const askDelayMs = 6000;
export const doneMs = 6000;
export const deniedMs = 4000; // hintKm = 50 stays a module constant
export interface SkySpot { kind: "moon" | "none" | "sun"; radius: number; x: number; y: number } // CSS px, y from the top
export interface AskContext { asked: boolean; crawler: boolean; home: boolean; lightLoad: boolean; pinned: boolean; saved: boolean }
export interface WhereHint { city: string | null; lat: number | null; lon: number | null }
export const mayAsk = (context: AskContext): boolean; // home and none of the other flags
export const forcedCity = (search: string): string | undefined; // ?bubble=<city>, trimmed, 1 to 60 characters
export const hintLabel = (spot: LatLon, hint: WhereHint | undefined): string; // hint city within 50 km of the hint spot, else coordinateLabel
export const skySpot = (moon: readonly [number, number, number, number], sun: readonly [number, number, number], height: number): SkySpot;
export const bubbleBox = (spot: SkySpot, viewport: { height: number; width: number }, bubble: { height: number; width: number }): { arrow: boolean; left: number; top: number };
export const askPosition = (geo: Pick<Geolocation, "getCurrentPosition"> | undefined, guardMs?: number): Promise<LatLon | undefined>;
// src/lib/weather.ts
export type WeatherWord = "clear" | "cloudy" | "drizzle" | "fog" | "partly" | "rain" | "snow" | "storm";
export const weatherWord = (code: number): WeatherWord;
```

- `skySpot`: the sun when its disk is on screen, else the moon when `moon[3] > 0` and it is on screen, else `none`. Input is paint px with y up; output y is from the top.
- `bubbleBox`: under the spot with a 12 px gap, centered, kept 16 px from both sides. With `none`, or when the box would end below `viewport.height - 96` (footer room), it sits bottom right: `left = width - bubble.width - 16`, `top = height - 96 - bubble.height`, no arrow.
- `askPosition`: `getCurrentPosition` with `{ enableHighAccuracy: false, maximumAge: 1_800_000, timeout: 10_000 }`; resolves `roundPlace` of the coordinates; `undefined` on an error, without `geo`, or when the guard timer (default 11 000 ms) fires first.
- `weatherWord`: 0 and 1 clear; 2 partly; 3 cloudy; 45 and 48 fog; 51 to 57 drizzle; 61 to 67 and 80 to 82 rain; 71 to 77, 85 and 86 snow; 95 to 99 storm; any other code cloudy.
- `en.sky` gains (copy from spec 4.8; `doneQuiet` and `label` are Claude's): `askLead: "That's the real sky over Vienna right now."`, `askCity: "Want the sky over {city} instead?"`, `askPlain: "Want yours instead?"`, `show: "Show my sky"`, `keep: "Keep Vienna"`, `done: "Your sky now. {place}, {weather}."`, `doneQuiet: "Your sky now. {place}."`, `note: "Rounded to about 10 km. Kept only on this device."`, `back: "Back to Vienna"`, `denied: "No problem. Vienna it is."`, `pickerPlace: "Sky over {place}"`, `useMine: "Use mine"`, `label: "Sky location"`, `weather: { clear: "clear", cloudy: "cloudy", drizzle: "drizzle", fog: "fog", partly: "partly cloudy", rain: "rain", snow: "snow", storm: "storm" }`.

- [ ] **Step 1: Write the failing tests:**

```ts
it("places the bubble under the moon", () =>
  assert.deepEqual(
    bubbleBox(
      { kind: "moon", radius: 40, x: 1000, y: 200 },
      { height: 900, width: 1440 },
      { height: 120, width: 300 }
    ),
    { arrow: true, left: 850, top: 252 }
  ));
it("moves the bubble bottom right without a spot", () =>
  assert.deepEqual(
    bubbleBox(
      { kind: "none", radius: 0, x: 0, y: 0 },
      { height: 900, width: 1440 },
      { height: 120, width: 300 }
    ),
    { arrow: false, left: 1124, top: 684 }
  ));
it("keeps the bubble inside the side margins", () =>
  assert.equal(
    bubbleBox(
      { kind: "sun", radius: 30, x: 1430, y: 200 },
      { height: 900, width: 1440 },
      { height: 120, width: 300 }
    ).left,
    1124
  ));
it("gives up when the browser never answers", async () =>
  assert.equal(
    await askPosition({ getCurrentPosition: () => undefined }, 20),
    undefined
  ));
it("rounds the answer", async () => {
  const geo = {
    getCurrentPosition: (ok: PositionCallback) =>
      ok({
        coords: { latitude: 52.5163, longitude: 13.3777 },
      } as GeolocationPosition),
  };
  assert.deepEqual(await askPosition(geo), { lat: 52.5, lon: 13.4 });
});
it("names the weather", () => {
  const cases: Array<[number, WeatherWord]> = [
    [0, "clear"],
    [2, "partly"],
    [3, "cloudy"],
    [45, "fog"],
    [53, "drizzle"],
    [63, "rain"],
    [81, "rain"],
    [73, "snow"],
    [86, "snow"],
    [96, "storm"],
    [42, "cloudy"],
  ];
  for (const [code, word] of cases) assert.equal(weatherWord(code), word);
});
```

Also: `it("asks only a fresh visitor on home")` (true only when `home` is true and the five other flags are false; each flip gives false), `it("reads ?bubble=")` (`"?bubble=Berlin"` gives `"Berlin"`, `"?bubble="` gives `undefined`), `it("labels by the hint city within 50 km")` (spot 52.5, 13.4 with the hint Berlin 52.52, 13.40 gives `"Berlin"`; spot 48.2, 16.4 with that hint gives `"48.2° N, 16.4° E"`; no hint or a `null` hint spot gives the coordinates).

If the `as GeolocationPosition` cast fails lint, build a full `GeolocationPosition`-shaped object instead.

- [ ] **Step 2: Run** `node --test src/lib/sky-ask.test.ts src/lib/weather.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests. Expected: PASS.

### Task 18: Bubble and picker components, privacy line

**Files:**

- Create: `src/components/sky-bubble.tsx`, `src/components/sky-picker.tsx`
- Modify: `src/pages/index.astro` (`<SkyBubble client:idle={{ timeout: 1000 }} />`), `src/components/site-footer.astro` (`<SkyPicker client:idle />` after the credit when `weather` is set), `src/components/space-background.tsx` (on home, send `sky:spot` with `skySpot(...)` on every scene refresh and resize), `src/styles/card.css` (bubble, reuse the `--glass-blur` material of the home controls), `src/styles/globals.css` (picker), `src/lib/i18n.ts` (`en.privacy.location`), `src/components/privacy-note.tsx`, `src/lib/icon-data.ts` (run `pnpm icons` after using `lucide:map-pin`)

**Interfaces:**

- Consumes: Tasks 1, 4, 16 and 17.

Bubble (spec 4.8):

- It waits `askDelayMs` after the first `sky:spot`. With `forcedCity(location.search)` it shows with that city and no `/where` call. Else when `mayAsk(...)` it calls `fetch("/where")` and shows only when `far` is true (a failure means no bubble).
- `astro:before-swap` (leaving home) cancels the timer and any request.
- Copy: `askLead`, then `askCity` with the city or `askPlain`. Buttons "Show my sky" (pin icon) and "Keep Vienna".
- "Show my sky": `askPosition(navigator.geolocation)`. No answer gives `denied`, gone after `deniedMs`. An answer gives `place = { kind: "visitor", label: hintLabel(spot, where), ...spot }`, then `choosePlace(place)` and `loadWeather(place, deps)`; then `done` with `en.sky.weather[weatherWord(code)]` (or `doneQuiet`), the `note` line and "Back to Vienna" (`choosePlace(undefined)`), gone after `doneMs`.
- Every end (show, keep, Escape, denied) writes `sky-place-asked`, guarded.
- `<aside aria-label={en.sky.label}>` with one `aria-live="polite"` line. Not a modal; it never takes focus. Escape closes it. No fade under reduced motion. Position from `bubbleBox` and the last `sky:spot`; width at most `min(20rem, 100vw - 32px)`.

Picker: the place text "Sky over {place}" and a button "Use mine" (Vienna) or "Back to Vienna" (visitor place), the button described by the place text. The server renders Vienna; after hydration it reads `readPlace()` and follows `sky:place`. "Use mine" runs `askPosition` and labels with `coordinateLabel` (there is no hint here). A denial shows `en.sky.denied` in its live line for `deniedMs`.

Privacy: `en.privacy.location`: "If you share your location, it is rounded to about 10 km, kept only on this device and sent only to Open-Meteo." after the weather line.

- [ ] **Step 1: Implement** the components, the event and the styles.
- [ ] **Step 2: Run** `pnpm fix`, all tests, `pnpm astro check` and `pnpm exec knip`. Expected: all clean.
- [ ] **Step 3: Commit** (background): `feat(sky): location bubble, footer picker and /where`, with the Part 5 paths.

---

## Part 6: Docs, checks and review (commit 6)

### Task 19: Docs and rules

**Files:**

- Modify: `CLAUDE.md`, `docs/architecture.md`, `.claude/rules/sky.md`, `src/lib/blog/diagrams.ts`

- [ ] **Step 1: Update.**
  - `CLAUDE.md`: the intro (no skyline; the visitor can pick their place), the credit rule (every footer whose page shows live weather), Commands (`pnpm moon`), the Layout lines for new and deleted files, the `worker/` line (`where (/where)`, no weather).
  - `docs/architecture.md`: the Worker bullet (`run_worker_first` `["/mcp", "/mcp/*", "/where"]`), the Weather bullet (browser client, cache, fields, layers, haze, rain, fog), the Sky modes bullet (painted night on the other pages, one program).
  - `.claude/rules/sky.md`: the paths list (new files), Painted home sky (no skyline, the table, the 90 degree view with the horizon at 2%, the space band, the star gate, the moon and its layer, texture units 0 to 3), Sky modes (D2; the site no longer draws `longRaysShader`, `sky-rays.ts` stays for the images), the shot (one program, `mixScene`), the ink numbers from Task 20.
  - `src/lib/blog/diagrams.ts`: `"/mcp, /weather"` becomes `"/mcp, /where"`; drop the Vienna skyline from the layers text.
- [ ] **Step 2: Check:** `rg -n "skyline|/weather|weatherPath|viennaLatitude|blogLook" CLAUDE.md docs .claude src worker`. Expected: only intended mentions (old specs and plans stay as they are).

### Task 20: Visual, accessibility and speed checks

Scripts stay in the scratchpad. Run against `pnpm preview` on `http://localhost:4321`.

- [ ] **Step 1: Frames** at 1440 x 900 and 390 x 844 (Chromium; WebKit at 390 x 844): `?at=` golden `2026-10-19T15:16:00Z`, civil dusk `2026-10-19T16:12:00Z`, nautical dusk `2026-10-19T16:42:00Z`, night with a gibbous moon `2026-11-20T16:50:00Z`, crescent at dawn `2026-11-04T04:10:00Z`, day `2026-10-19T09:30:00Z`; every `?weather=` preset; `?place=52.5,13.4`; a routed Open-Meteo answer with only high cloud (the 19:15 case: a veil, the moon shows through). Compare with the pick page frames.
- [ ] **Step 2: Other pages:** `/blog`, `/work`, `/about` and `/404` show the D2 night look, the footer credit and the picker.
- [ ] **Step 3: Bubble flows** (`page.clock` to skip time): `?bubble=Berlin` with `context.setGeolocation({ latitude: 52.52, longitude: 13.405 })` and the permission granted gives the done copy; a denied permission gives the denied copy; leaving for `/blog` at 3 s gives no bubble and no `/where` request.
- [ ] **Step 4: Accessibility:** `~/powertools/benches/web-perf/scripts/axe-check.mjs` at three sizes and at 200% zoom with the bubble open. Expected: 0 violations.
- [ ] **Step 5: Ink:** measure the home ink contrast over a stepped day (every 20 min of 2026-10-19, plus the presets) and write the worst held numbers into `.claude/rules/sky.md`. If a target gets worse than today's number by more than 0.3, report to the owner before changing `inkMargin`.
- [ ] **Step 6: Speed:** `~/powertools/benches/web-perf/scripts/site-probe.mjs` on a throttled phone profile for `/` and `/blog`. Expected: no new long tasks at start.
- [ ] **Step 7: Stop** every server and script this task started.

### Task 21: Final review and finish

- [ ] **Step 1: Review.** Run the `code-reviewer` agent (Opus, high) on the fixed range `<sha before Part 1>..HEAD` with the spec and this plan. Hand back at most 4,000 characters; the rest goes to a file in the scratchpad.
- [ ] **Step 2: One fix round.** Fix the real findings, run the touched tests, commit with the docs (Task 19, 20 numbers) as `docs: sky rework docs and rules` plus `fix(sky): review fixes` if code changed.
- [ ] **Step 3: Stop here.** Do not push. When the owner says push: `git fetch`, squash this work into one commit on `main`, `git push --force-with-lease`, watch CI and the Cloudflare build, wait until `https://stevanpavlovic.com/build.json` shows the new `sha`, then check the live site.
