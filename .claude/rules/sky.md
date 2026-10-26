---
paths:
  - "src/components/space-background.astro"
  - "src/lib/sky-mount.ts"
  - "src/components/product-mark.tsx"
  - "src/lib/sky-shader.ts"
  - "src/lib/sky-view.ts"
  - "src/lib/sky-view.test.ts"
  - "src/lib/sky-sun.ts"
  - "src/lib/sky-sun.test.ts"
  - "src/lib/sky-tween.ts"
  - "src/lib/sky-tween.test.ts"
  - "src/lib/sky-ephemeris.ts"
  - "src/lib/sky-ephemeris.test.ts"
  - "src/lib/uniform-sink.ts"
  - "src/lib/sky-rays.ts"
  - "src/lib/sky-rays.test.ts"
  - "src/lib/sky-preset.ts"
  - "src/lib/webgl.ts"
  - "src/lib/frame-clock.ts"
  - "src/lib/frame-clock.test.ts"
  - "src/lib/product-marks.ts"
  - "src/lib/name-tear.ts"
  - "src/lib/portrait-lens.ts"
  - "scripts/generate-images.ts"
  - "scripts/generate-moon-map.ts"
  - "scripts/moon-map.ts"
  - "scripts/moon-map.test.ts"
  - "src/components/sky-bubble.tsx"
  - "src/components/sky-controls.tsx"
  - "src/lib/geo.ts"
  - "src/lib/moon-layer.ts"
  - "src/lib/moon-layer.test.ts"
  - "src/lib/sky-ask.ts"
  - "src/lib/sky-ask.test.ts"
  - "src/lib/sky-ink.ts"
  - "src/lib/sky-ink.test.ts"
  - "src/lib/sky-light.ts"
  - "src/lib/sky-light.test.ts"
  - "src/lib/sky-moon.ts"
  - "src/lib/sky-moon.test.ts"
  - "src/lib/sky-moon-shader.ts"
  - "src/lib/sky-paint.ts"
  - "src/lib/sky-paint.test.ts"
  - "src/lib/sky-paint-shader.ts"
  - "src/lib/sky-place.ts"
  - "src/lib/sky-place.test.ts"
  - "src/lib/place-name.ts"
  - "src/lib/place-name.test.ts"
  - "src/lib/place-lookup.ts"
  - "src/lib/place-lookup.test.ts"
  - "scripts/generate-places.ts"
  - "scripts/places-data.ts"
  - "scripts/places-data.test.ts"
  - "src/lib/sky-preview.ts"
  - "src/lib/sky-preview.test.ts"
  - "src/lib/sky-clock.ts"
  - "src/lib/sky-clear.ts"
  - "src/lib/sky-clear.test.ts"
  - "src/lib/sky-probe.ts"
  - "src/lib/weather.ts"
  - "src/lib/weather.test.ts"
  - "src/lib/weather-client.ts"
  - "src/lib/weather-client.test.ts"
---

# Sky, shaders and the globe

Siblings: `card.md`, `motion.md`. Weather and place facts are in `docs/architecture.md`.

## Structure

- One painted sky for the whole site. The sky is real: the real sun and moon, the live weather of the chosen place. Do not fake it.
- `watchSky` (`sky-mount.ts`) starts the runtime once per canvas node. The `div[data-blog-sky]` and `div[data-sky-sentinel]` persist across client navigation (`transition:persist`).
- One WebGL context draws two programs: `cloud` writes a cloud texture, `paint` draws the sky and composes.
- Texture units: 0 ink probe, 1 clouds, 2 sky light table (`u_lut`), 3 moon map. Set samplers with `gl.uniform1i`.
- Never sample the probe texture. Programs link with `KHR_parallel_shader_compile` (`whenLinked`). Never block on a compile.
- The shaders work in the screen frame: `u_res` and `u_floor`, not the 140lvh canvas.
- three.js loads only in the lazy globe chunk of the Mine tab. It never loads on first paint.

## Modes

- The mode comes from the route (`routeMode`). `home` is the live sky of the chosen place. `story` is `/work/website`: one fixed day driven by scroll (`sky-story.md`). `blog` covers the blog, `/work`, `/about` and the 404.
- `blog` is a fixed painted night: stars, grain, the fixed calm clouds (`nightWeather`) and corona rays from the top-left corner (`coronaSpot`). No sun, moon, rain, snow or fog. It never reads the live weather, the place, `?weather=` or the preview.
- Parallax runs on the compositor (`sky-drift`). Never redraw the shader per scroll frame.
- Reduced motion, the Motion pause, Save-Data, crawlers and software renderers get a still sky and no parallax.

## Home sky

- `paintScene(instant, view, weather, place)` in `sky-paint.ts` is pure.
- `moonView` matches JPL Horizons within 0.006 degrees (`sky-moon.test.ts` holds the bounds).
- Build the sky light table (`sky-light.ts`) on idle, never in the first frame.
- No skyline, no Riesenrad.
- Every cloud is pixel art (2 canvas px cells, 6 flat tones) on every page and in social images. Sky colors, stars, rays, sun, moon, mist and grain stay smooth.
- Weather: only the home reads it (`weatherAllowed`). `?weather=` and `?place=` pin values.
- A still frame never shows moving snow or rain. `u_still` and `u_clear` keep flakes and streaks clear of the card text (`sky-clear.ts`).

## Home to blog shot

- Home to `/blog`, `/work` or `/about` plays a 1.0 s shot. The brand link plays it in reverse.
- Only the sun moves, on an arc from its real spot to the corner corona (`sky-tween.ts`). Its disk goes out once it is two radii off screen, so no bright disk ever grows at the corner.
- The corona never moves: it only fades in or out with the shot (owner, 2026-10-24: a corona riding the arc flashed white at the screen edge).
- A shot back home snaps the shown weather to the home goal at the click. At the click the shot also pins `--sky-paint`, `--sky-shift` and `--sky-fade-now`, so no frame shows the overlay or the fade at 0.
- The shot is an instant swap under pause, reduced motion, crawlers, Save-Data, a software renderer, a hidden tab and without WebGL.
- `?tween=<0..1>` holds the shot for frame tests.

## Text over the sky

- No boxes, shadows or rays behind text. Text glow is need-only (owner, 2026-10-24: "try to remove everywhere").
- `inkTargets` (home: name at 3 as large text, bio and copyright at 4.5) and `postInkTargets` (night pages) in `sky-ink.ts` set the ink targets. `createSkyProbe` reads the sky behind each text box.
- The name and the bio are one ink group, so they never show two inks. `wantedInk` and `nextInk` choose dark ink with a margin (`inkMargin` 1.35) and a two-read rule. Dark ink is preferred on a bright sky.
- The `text-sky` utility in `globals.css` is the one place that draws the glow (`--glow`, `glowFor`): four layers (1, 4, 10, 18 px), 0 while the ink reaches its target with the margin. No other text on the site has a text shadow.
- Known miss (owner, 2026-10-21): on a phone the clear full moon can sit behind the name, which then reads about 2.2:1 (2.8 before the 2026-10-24 glow trim). The small footer clock reads 4.48 once at dusk, overcast, phone. The sky stays real.
- Measure contrast with the glow on, on real pixels under the text, with the sky held still (`pnpm audit:site --only contrast`). Dark ink is measured against the darkest sky next to it.
- `?at=<ISO instant>` pins the time and stops the page from counting as a crawler. Headless Chromium counts as a crawler otherwise.

## Place, name and bubble

- Round the place to 0.1 degree before anything sees it. Never put the position into a URL or request. The position never leaves the page.
- The panel shows "City, Country" and the credit link "City names: GeoNames" (CC BY 4.0). Keep both.

## Time and Weather preview

- The footer sky panel previews other hours and weather. It is per visit, never stored, and shows only in the Custom tab. There are no Now or Live chips. A reload returns to the real sky.
- Range config and math live in `skyRanges` (`sky-range.ts`). A key with Alt, Ctrl or Meta goes to the browser.
- Text first: the sky draws the goal scene into the ink probe at once (`probeGoal`), then eases to it after 100 ms over 350 ms. Never run `probeGoal` every frame.
- The day is computed in the place's zone (`placeZone`, `sky-clock.ts`).

## Globe (Mine tab)

- `SkyGlobe` is lazy and mounts only while the panel is open on Mine. It renders on demand, frees everything on unmount and calls `forceContextLoss`.
- While dragging, "Near City, Country" shows in an `aria-hidden` line. The settled `aria-live` line carries the pick.
- Logo planets (`product-mark.tsx`) are an `aria-hidden` inline SVG. There is no planet canvas.
