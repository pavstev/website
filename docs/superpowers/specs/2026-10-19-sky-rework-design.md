# Sky rework design

Date: 2026-10-19. Status: approved by the owner on 2026-10-19. Plan: `docs/superpowers/plans/2026-10-19-sky-rework.md`.

This spec changes parts of `2026-10-19-painted-home-sky-design.md` (skyline, Vienna as the only place, clock palettes, weather through the Worker) and the "blog keeps `longRaysShader`" line in `.claude/rules/sky.md`. Where they disagree, this spec wins.

Look reference: the pick page <https://claude.ai/artifact/WLcpCAuK5HhoMJ7wTxA1qX>. Its readable sources are in `_ref/sky-rework/` (local only, ignored by git): `scatter.ts` (physical sky light), `moon-map.ts` (drawn moon map), `shaders.ts` (shader patches), `preview.ts` (scene and knobs). Helpers in another worktree need a copy.

## 1. What the owner asked

1. Better moon details and a cooler moon.
2. No Vienna skyline.
3. A small bubble that asks the visitor for a precise location, so the sky shows their weather. Fun, smart and elegant.
4. Blog, Work and About get the painted style of the home page, but always night, with light rays from the top left.
5. Use the weather data correctly. Dusk is too yellow today.
6. Without the skyline, tilt the view up a little and show some space with stars at the top of the page.

## 2. Decisions

| #   | Topic          | Decision                                                                                                                                                         | Source                                               |
| --- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | Moon           | A1 "Real moon": drawn map, crater shadows near the terminator, earthshine, soft aura 0.55, radius 1.85 x today                                                   | Owner pick, owner answer "drawn map, cool, artistic" |
| 2   | Skyline        | Removed, with the Riesenrad and the city hatching                                                                                                                | Owner                                                |
| 3   | Perspective    | B2: horizon at 2% of the height, top edge looks straight up, a space band over the top 14% with stars by day and by night                                        | Claude default (owner did not pick B)                |
| 4   | Dusk           | C2 "Real light": physical sky colors, haze 1.2                                                                                                                   | Claude default (owner did not pick C)                |
| 5   | Other pages    | D2 "Corona rays": painted night, rays from the top-left corner, light `#FFE6C4`, strength 1, live clouds for the chosen place                                    | Claude default, owner answer on clouds               |
| 6   | Bubble         | E1 "Moon note" with the city hint, plus a small place picker in the footer                                                                                       | Claude default, owner answers                        |
| 7   | Location scope | The whole sky follows the chosen place: sun, moon, stars and weather                                                                                             | Owner                                                |
| 8   | City hint      | Yes. The Worker reads only the rough city from Cloudflare request data                                                                                           | Owner                                                |
| 9   | Weather fetch  | The browser asks Open-Meteo directly. The Worker `/weather` route and the 30-minute timer go away. Claude read "no background fetching" as "no backend fetching" | Owner answer, Claude reading                         |

Defaults Claude chose and the owner can change in review: items 3 to 6, the 100 km "far" rule, the 0.1 degree rounding, the 6 second delay, and no moon, rain, snow or fog on the other pages.

## 3. Scope

In scope:

- The home sky (`paint` and `cloud` programs) and the sky of `/blog`, `/work` and `/about`.
- A new moon renderer, a drawn moon map and a sharp moon layer.
- A place model, a browser weather client, the bubble, the footer picker.
- A Worker route `/where` for the city hint. The Worker route `/weather` is deleted.
- CSP, privacy text, credits, docs and rules.

Out of scope:

- No NASA or other downloaded moon texture.
- No reverse geocoding service and no city search.
- No server storage of any place.
- No change to the card, the `/work` rows, the blog content or the social images (`scripts/generate-images.ts` keeps `longRaysShader`).
- No day sky on the other pages.

## 4. Design

### 4.1 Place

New `src/lib/sky-place.ts` (pure, tested, plus small storage helpers):

- `SkyPlace`: `{ lat, lon, label, kind }`, `kind` is `"vienna"` or `"visitor"`.
- `viennaPlace`: 48.2082, 16.3738, label from `en.sky.vienna`. It replaces `viennaLatitude` and `viennaLongitude` in `sky-sun.ts`.
- `roundPlace(lat, lon)`: round to 0.1 degree (about 10 km). Every visitor place is rounded before anything else sees it.
- `readPlace()`, `savePlace(place)`, `clearPlace()`: `localStorage` key `sky-place`, inside `try`/`catch`. Stored: the rounded `lat`, `lon` and `label`. Nothing else.
- `distanceKm(a, b)`: haversine, for the "far" rule and the label rule.
- `placeOverride(search)`: `?place=<lat>,<lon>` pins a place for tests, like `?at=` and `?weather=`.
- Crawlers always get Vienna.

All sky math takes the place: `paintScene(instant, view, weather, place)`, `sunSpot(instant, view, place)`, and `moonView` and `sunPosition` get the place's latitude and longitude. A place change sends `sky:place` on `window`. The sky listens, rebuilds the scene and loads the weather for the new place.

### 4.2 Weather in the browser

New `src/lib/weather-client.ts`. `src/lib/weather.ts` keeps the mapping.

- Request: `GET https://api.open-meteo.com/v1/forecast` with the place and `current=cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,weather_code,wind_speed_10m,wind_direction_10m,visibility,relative_humidity_2m,precipitation`. Checked live on 2026-10-19: every field exists; covers and humidity are in %, visibility in m, precipitation in mm per 15 minutes (`interval` 900); the answer has `access-control-allow-origin: *` and no cache header.
- When: once when the sky starts on a full page load (every page, as the other pages now show live clouds; a `ClientRouter` swap does not ask again), once after a place change, and when the visitor comes back to a hidden tab after 30 minutes or more. No `setInterval` and no fetch while the tab is hidden.
- Cache: the last report per rounded place in `sessionStorage` for 15 minutes, so page loads in one visit do not ask again.
- Skip the fetch for crawlers, Save-Data and `?weather=`. Timeout 8 s. On any failure keep `fallbackWeather` (partly cloudy) and try again only on the next start, place change or tab return.
- The parser stays hand-written (no zod in the browser bundle), as `parseReport` is today.

`SkyWeather` grows so the data is used fully. Example from the live check at 19:15: Vienna had `cloud_cover` 100, but all of it high (`cloud_cover_high` 100, low and mid 0). Today the site paints that as a full grey deck. With layers it is a thin high veil, and the moon shows through it.

- `cumulus` from `cloud_cover_low`, `mid` from `cloud_cover_mid` (a higher, finer cumulus layer), `cirrus` from `cloud_cover_high`. When low plus mid cover passes 85%, the overcast deck joins. Today one `cover` number drives all layers.
- `haze` from `visibility` and `relative_humidity_2m`: 1 on a normal day (visibility 20 km or more, humidity under 70%), up to 2.5 as visibility drops to 2 km or humidity reaches 95%, down to 0.8 above 40 km. It feeds the Mie haze of the sky light (4.3) and the horizon mist.
- `rain` strength 0 to 1 from `precipitation` (0.1 mm per 15 minutes gives 0.3, 1 mm gives 1) plus the weather code. Today rain is on or off.
- `fog` from codes 45 and 48 or visibility under 1 km. `snow` and wind stay as today.
- `?weather=<clear|partly|overcast|rain|snow|fog>` presets stay and fill the new fields.

### 4.3 Dusk and day light (C2)

New `src/lib/sky-light.ts`, a port of `_ref/sky-rework/scatter.ts` (pure, tested):

- Single scattering along each view ray: Rayleigh, Mie (haze 1.2 times the weather `haze`), ozone, the Earth's shadow.
- A multiple scattering fill (dome average, strength 0.6), a blue hour tint (strength 1), exposure adaptation 0.28, and a tone map that keeps the hue.
- Output: a 72 x 44 RGBA8 color table over the screen, plus an ambient color and a cloud light color for the cloud pass.
- At night it blends into the painted night palette (sun from -16 to -6 degrees), so nights keep today's look.
- The paint shader reads the table (`u_lut`, texture unit 2) in place of the low, mid and top gradient.
- Cost: 4 to 7 ms per table on the M5 (measured on the prototype). The table is built only on scene refresh (every 30 s, resize, place change, weather ease). The plan measures it with a 4x CPU slowdown. If one build passes 16 ms there, it moves to idle time or a Web Worker.
- `clockPalette` and the day and dusk palettes in `theme.ts` go if nothing else uses them. The night palette and the tints that are still used stay.

Target result (from the prototype): +6 degrees blue sky with a golden horizon, -3 degrees violet with a red band, -8 degrees deep navy. Not yellow.

### 4.4 Perspective and space band (B2)

- `sky-view.ts`: the horizon moves from 6% to 2% of the height. The vertical scale changes from 0.88 x height per 72 degrees to 0.98 x height per 90 degrees, so the top edge looks straight up.
- The space band: the top 14% of the screen blends into a space color (new token in `theme.ts`) with stars at 0.95, by day and by night.
- Below the band, stars show only where the real sky is dark. The star gate reads the sky brightness: stars start when the sun is 1 degree below the horizon and are full 8 degrees later.

### 4.5 Moon (A1)

Map:

- `scripts/generate-moon-map.ts` ports `_ref/sky-rework/moon-map.ts` (fixed seed, same output every run) and writes `src/assets/moon-map.webp` with sharp (already a dependency): one grayscale image, 512 x 512, top half albedo, bottom half height. Target size under 60 KB. Committed. `pnpm moon` runs the script.
- The page imports it with `?url`, so it gets a hashed, immutable name.
- It loads after the first frame, and only while a moon is on screen.

Look (the A1 frames on the pick page):

- Lommel-Seeliger light, a small opposition surge.
- Crater relief only near the terminator, so craters cast shadows there and the full face stays smooth.
- Earthshine on the dark part.
- A warmer, dimmer moon near the horizon (air mass extinction).
- A soft aura at 0.55. No 22 degree halo.
- Radius 1.85 x today, so about 0.047 x the screen height.

Sharp moon layer:

- The main canvas draws at 0.75 scale or less, which blurs a small moon. So the moon disk draws in its own small canvas at device pixel density (cap 2), placed over the moon with `mix-blend-mode: plus-lighter` (fallback `screen`).
- The main shader keeps the sky behind the moon, hides stars inside the disk, and draws the aura and the clouds.
- Clouds in front of the moon: the main context reads a 32 x 32 patch of the cloud texture around the moon (on a 900 px tall screen; up to 64 x 64 on taller ones), one cloud frame late (the same pattern as the ink probe). The moon layer uploads it and dims the moon by the cloud alpha.
- The moon layer follows the frame pacing and still frame rules of the main sky. In the home to blog shot it fades out with the moon.
- Fallback: if the second WebGL context or the map fails, the main shader draws the moon itself, softer.
- The moon GLSL lives in one module. The paint program and the moon layer both use it.

### 4.6 Skyline removal

- Delete `cityLayer`, `skylineLayer`, `sdBox`, `sdSeg`, `spire`, `hillH`, `roofBand` and the Riesenrad from `sky-paint-shader.ts`.
- Delete the skyline notes in docs and rules. The city glow on low clouds at night (the `city` tint in `sky-paint.ts`) stays: it is real sky glow, not the skyline.
- `mistLayer` stays, driven by the weather `haze`. It no longer hides a city.

### 4.7 Other pages (D2)

- `/blog`, `/work` and `/about` draw the `paint` and `cloud` programs in a fixed night look: night palette, stars, grain, the live clouds of the chosen place (layers and wind), and corona rays from the top-left corner (`cornerCorona(view)`, strength 1, light `#FFE6C4` as a theme token).
- No sun disk, no moon, no rain, no snow, no fog, no color table there.
- Rays: share the corona GLSL with `sky-rays.ts` if it splits out cleanly and the social images stay pixel equal, so the site and the images keep one ray look. Else port it. The result must match the D2 frame.
- The shooting star stays. Crawlers get the still painted night.
- The home to blog shot: one program for both modes. The shot tweens the scene: sky colors from the live home sky to the night look, the light source along `tweenPose` to the corner, the sun and moon fade, stars rise. One draw per frame. `?tween=` stays.
- The site no longer draws `longRaysShader`. `sky-rays.ts` stays for `scripts/generate-images.ts`.
- The fade layer, the parallax and the blog ink targets stay. Body text keeps at least 9.9:1.
- The footers of the blog pages, `/work` and `/about` show the "Weather: Open-Meteo" credit and the place picker, as they now show live weather.

### 4.8 Bubble (E1) and picker

Bubble:

- Home only. Once per visitor (`localStorage` key `sky-place-asked`). It shows 6 s after the sky runs, and only when `/where` says the visitor is more than 100 km from Vienna.
- Never for crawlers, Save-Data, `?place=` or a saved visitor place. `?bubble=<city>` forces it for tests.
- A small glass note with a short arrow. It sits under the moon at night and under the sun by day. If neither is on screen, it sits bottom right above the footer. The sky sends `sky:spot` with the moon or sun position, and the bubble follows it.
- Copy (all in `src/lib/i18n.ts`, `en.sky`):
  - Ask: "That's the real sky over Vienna right now. Want the sky over {city} instead?" Without a city: "Want yours instead?"
  - Buttons: "Show my sky" (pin icon) and "Keep Vienna".
  - Done: "Your sky now. {place}, {weather word}." Small line: "Rounded to about 10 km. Kept only on this device." Button: "Back to Vienna". It fades out after 6 s.
  - Denied or failed: "No problem. Vienna it is." It fades out after 4 s.
  - Weather words by code group: clear, partly cloudy, cloudy, fog, drizzle, rain, snow, storm.
- Location: only after the click, `navigator.geolocation.getCurrentPosition` with `enableHighAccuracy: false`, `maximumAge` 30 minutes, `timeout` 10 s. The result is rounded at once.
- Place label: the hint city when the precise spot is within 50 km of the hint spot. Else "52.5° N, 13.4° E".
- It is not a modal. It never takes focus. Escape closes it. It has an accessible name. Under reduced motion it appears without a fade.

Picker:

- A small text button in the footer next to the weather credit, on every page whose sky shows live weather: "Sky over Vienna · Use mine" or "Sky over {place} · Back to Vienna".
- "Use mine" asks for the location the same way. "Back to Vienna" clears the saved place.

### 4.9 Worker `/where`

- New `worker/where.ts` with tests. `GET /where` answers `{ city, far, lat, lon }` from `request.cf`: the city name, `far` when more than 100 km from Vienna, and the rough spot rounded to 0.1 degree. `null` fields when Cloudflare has no data.
- No upstream fetch and no logging. Headers: `Cache-Control: private, no-store`, `X-Robots-Tag: noindex` and the security headers from `worker/http.ts`. Other methods get 405.
- The client asks `/where` only when the bubble could show (home, never asked, no saved place), after the 6 s delay.
- `run_worker_first` becomes `["/mcp", "/mcp/*", "/where"]`. Delete `worker/weather.ts`, `worker/weather.test.ts`, `weatherPath` and `weatherEveryMs`.
- `astro dev` has no Worker. A failed `/where` means "no bubble".

### 4.10 Privacy, CSP and credits

- `public/_headers`: `connect-src` adds `https://api.open-meteo.com`.
- `Permissions-Policy`: `geolocation=()` becomes `geolocation=(self)` in `public/_headers` and in `worker/http.ts`, so the bubble and the picker may ask. The two lists stay equal.
- The privacy note (`en.privacy`) gets two lines: "Your browser asks Open-Meteo for the weather, so Open-Meteo sees your IP address." and "If you share your location, it is rounded to about 10 km, kept only on this device and sent only to Open-Meteo."
- The chip "No cookies, anonymous stats" stays true: the place lives in `localStorage`, not in a cookie.
- `request.cf` is Cloudflare request data, not a new data source. It needs no credit.

## 5. Data flow

1. The page starts. The place is the saved visitor place, or Vienna.
2. The sky draws its first frame with the fallback weather (or the cached report).
3. After the first frame, the browser asks Open-Meteo once for the place. The scene eases to the real weather over about 3 s.
4. On home, while a moon is on screen, the moon map loads and the moon layer starts.
5. On home, after 6 s, if the bubble could show: `GET /where`. If the visitor is far, the bubble shows.
6. "Show my sky": the browser asks for the location, rounds it, saves it and sends `sky:place`. Steps 3 and 4 run again for the new place.

## 6. Errors

| Case                               | Result                                                                |
| ---------------------------------- | --------------------------------------------------------------------- |
| Open-Meteo fails or takes over 8 s | Fallback weather. Try again on next start, place change or tab return |
| Location denied or timed out       | "No problem. Vienna it is." The bubble is marked as asked             |
| Storage throws                     | Everything works. The bubble can show again next visit                |
| Moon map fails                     | The main shader draws the moon without the map                        |
| Second WebGL context fails         | No moon layer. The main shader draws the moon                         |
| `/where` fails                     | No bubble                                                             |

## 7. Budget

- First paint and start long tasks stay as today. The weather request, `/where`, the moon map and the moon layer all start after the first frame.
- No new npm dependency.
- Moon map under 60 KB. Moon layer under 0.3 ms GPU per frame at device pixel ratio 2.
- Color table builds within the rule in 4.3.

## 8. Tests

- Unit tests (`node --test`): `sky-place` (rounding, storage guard, override, distance), weather mapping (layers, haze, rain strength, codes), `sky-light` (hue checks at +6, -3 and -8 degrees against the prototype numbers; no yellow at -3), `sky-view` (horizon 2%, zenith at the top edge), `worker/where` (fields, the far rule, headers, 405), the bubble rules (when it shows and when not).
- Visual checks in headless Playwright at 1440 x 900 and 390 x 844 with `?at=` for golden hour, civil dusk, nautical dusk, night with a gibbous moon, a crescent at dawn and day; with `?weather=` presets; with `?place=52.5,13.4`. Compare with the pick page frames.
- Accessibility gate: axe at three sizes and at 200% zoom, with the bubble open. Re-measure the home ink contrast, because the new day colors move it; update the numbers in `.claude/rules/sky.md`.
- Speed: `site-probe.mjs` on a throttled phone profile. No new long tasks at start.

## 9. Docs and rules to update

`CLAUDE.md` (the Worker serves `/mcp` and `/where`; layout lines), `docs/architecture.md` (Weather and Worker bullets), `.claude/rules/sky.md` (painted home sky, sky modes, moon, ink numbers), and the diagram copy in `src/lib/blog/diagrams.ts` (`/weather` becomes `/where`).

## 10. Risks

- Every visitor's browser now talks to Open-Meteo, so Open-Meteo sees visitor IP addresses. The privacy note says so. If the owner meant only "no timer", the Worker can keep the Vienna request and the browser asks Open-Meteo only for a visitor place.
- The new day colors can lower the home ink contrast. The re-measure in section 8 decides if `inkMargin` needs a change.
- `plus-lighter` needs Chrome 100, Safari 15.4 or a recent Firefox. Older browsers use `screen`, which looks close on a dark sky.
- Clouds over the moon come from a patch read one cloud frame late. A fast cloud edge can lag by one cloud frame (33 ms). That is not visible.
