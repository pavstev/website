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
- `src/components/space-background.astro` holds the markup. It takes no props.
- `src/lib/sky-mount.ts` is the runtime. `watchSky` starts it, once per canvas node.
- The markup is a fixed `div[data-blog-sky]` (one screen plus `--sky-travel` 40vh) with the canvas and `[data-sky-fade]`, and `div[data-sky-sentinel]`.
- Both persist across client navigation: `transition:persist` names `sky` and `sky-sentinel`.
- `data-space-state` is `running`, `paused`, `static` or `fallback`.
- One WebGL context draws two programs. `cloud` (`paintCloudShader`) writes a cloud texture. `paint` (`paintSkyShader`) draws the sky and composes.
- Texture units: 0 ink probe, 1 clouds, 2 sky light table (`u_lut`), 3 moon map. Set samplers with `gl.uniform1i`.
- Never sample the probe texture. Programs link with `KHR_parallel_shader_compile` (`whenLinked`). Never block on a compile.
- Shader, program and texture helpers are in `src/lib/webgl.ts`.
- The shaders work in the screen frame: `u_res` and `u_floor`, not the 140lvh canvas.
- three.js loads only in the lazy globe chunk of the Mine tab. It never loads on first paint.

## Modes

- The mode comes from the route (`routeMode`). `home` is the live sky of the chosen place. `story` is `/work/website`: the painted sky of one fixed day, driven by scroll (`sky-story.md`).
- `blog` covers the blog, `/work`, `/about` and the 404. A page with `[data-blog]` is `blog`.
- `blog` is a fixed painted night: night palette, stars, grain, the fixed calm clouds (`nightWeather`) and corona rays from the top-left corner (`coronaSpot`).
- `blog` has no sun, moon, rain, snow or fog. It never reads the live weather, the place, `?weather=` or the preview.
- Social images draw the same night through `scripts/generate-images.ts` (`nightScene`, no moon, fixed time).
- A shooting star flies on `cornerMeteor` (`sky-rays.ts`): 1.6 s every 6 s, only while the sky runs, never for crawlers.
- Parallax runs on the compositor (`sky-drift`, a scroll-driven `translate`). Never redraw the shader per scroll frame.
- `[data-sky-fade]` and `::after` darken the sky so prose keeps at least 7:1 contrast.
- The sky runs while the sentinel is in view and holds a still frame below.
- Reduced motion, the Motion pause, Save-Data, crawlers and software renderers get a still sky and no parallax.

## Home sky

- `paintScene(instant, view, weather, place)` in `sky-paint.ts` is pure. It refreshes every 30 s, on resize, swap and place change.
- Sun and moon come from `sky-ephemeris.ts` and `sky-moon.ts` for the chosen place. The view is `sky-view.ts`: horizon at 2%, 90 degrees up.
- `moonView` matches JPL Horizons within 0.006 degrees in position (worst 0.0051 over the six rows in `sky-moon.test.ts`). The test bounds hold that.
- By day the sun sits right of the card (`sunSpot`, radius 0.026 x height). At night the moon shows. No sun below -0.833 degrees.
- Space band: the top 24% blends into the `space` token with stars, on every screen.
- Sky colors come from single scattering written to a 40 x 24 table (`sky-light.ts`). Build it on idle, never in the first frame.
- Moon: the map is `src/assets/moon-map.webp` (`pnpm moon`). The sharp disk draws in its own canvas (`moon-layer.ts`).
- No skyline, no Riesenrad.
- Grey day: by day the overcast and rain deck is a light grey (`deckLight`, `overcast` palette in `sky-palette.ts`).
- Pixel clouds: every cloud is pixel art on every page and in social images. Cells are 2 canvas px, 6 flat tones, hard cumulus edge, lit rim.
- Sky colors, stars, rays, sun, moon, mist and grain stay smooth.
- Weather: only the home reads it (`weatherAllowed`). A swap eases `weatherShown` over about 3 s. `?weather=` and `?place=` pin values.
- A still frame (no loop) never shows moving snow or rain. `u_still` and `u_clear` keep flakes and streaks clear of the card text (`sky-clear.ts`).

## Home to blog shot

- Home to `/blog`, `/work` or `/about` plays a 1.0 s shot. The brand link plays it in reverse.
- Only the sun moves, on an arc from its real spot to the corner corona (`sky-tween.ts`). At night the corona grows from the corner.
- The page chrome fades out in 200 ms and in for 400 ms (`data-sky-leave`, `data-sky-arrive`).
- The shot is an instant swap under pause, reduced motion, crawlers, Save-Data, a software renderer, a hidden tab and without WebGL.
- `?tween=<0..1>` holds the shot for frame tests.

## Text over the sky

- No boxes, shadows or rays behind text. A subtle glow is fine.
- `text-sky` texts have ink targets in `sky-ink.ts`: `inkTargets` on the home (name at 3 as large text, bio and copyright at 4.5), `postInkTargets` on night pages.
- `createSkyProbe` (`sky-probe.ts`) reads the sky behind each text box. `liftFor` and `nextLift` pick the lift.
- By day the ink can be dark (`data-ink="dark"`). `wantedInk` and `nextInk` choose it with a margin (`inkMargin` 1.35) and a two-read rule.
- The name and the bio are one ink group, so they never show two inks.
- The glow is `--glow` (`glowFor`). It is full once the ink drops to its target. `card.css` turns it into an offset-free `text-shadow`. Topic words share it at rest. Not under 8 px blur, none in forced colors.
- Known miss (owner, 2026-10-21): on a phone the clear full moon can sit behind the name, which then reads about 2.8:1. The sky stays real and the glow keeps its look.
- Measure contrast with the glow on, on real pixels under the text, with the sky held still (`pnpm audit:site --only contrast`). Dark ink is measured against the darkest sky next to it. Axe cannot see the WebGL canvas.
- `?at=<ISO instant>` pins the time and stops the page from counting as a crawler. Headless Chromium counts as a crawler otherwise.

## Frame pacing

- Render scale 0.75, then 0.5, then 0.35 without clouds. At most 1.4 M pixels.
- 30 fps after 800 ms idle. Pause when hidden or blurred. Freeze after eight frames over 100 ms.
- One still frame under reduced motion and on a software renderer. `createFrameClock` drives `u_time`.

## Place, name and bubble

- The place is Vienna or the visitor's (`sky-place.ts`). Round it to 0.1 degree before anything sees it.
- The name comes from the offline GeoNames list. The position never leaves the page.
- The panel shows "City, Country" and the credit link "City names: GeoNames" (CC BY 4.0). Keep both.
- `choosePlace` sends `sky:place`. `namePlace` sends `sky:place-named` (only the footer reacts).
- Never put the position into a URL or request.
- The bubble (`sky-bubble.tsx`, rules in `sky-ask.ts`) places itself clear of the card, the portrait button included. A live region speaks the line.

## Time and Weather preview

- The footer sky panel previews other hours and weather. It is per visit, never stored, and shows only in the Custom tab.
- `SkyRange` (`sky-range.tsx`) is a native range input with `aria-valuetext`. Config and math live in `skyRanges` (`sky-range.ts`).
- Time: 1-minute steps, a tick every hour, labels every 6 hours. Weather: six stops, four small ticks between, magnets at 0.2.
- Keys: Time arrows go to the next 5 minutes, page keys to the hour, Home and End to the day ends. Weather keys move one stop.
- A key with Alt, Ctrl or Meta goes to the browser.
- State is the module store `sky-preview.ts`. There are no Now or Live chips. A reload returns to the real sky.
- Text first: the sky draws the goal scene into the ink probe at once (`probeGoal`), then eases to it after 100 ms over 350 ms.
- Never run `probeGoal` every frame.
- The day is computed in the place's zone (`placeZone`, `sky-clock.ts`).

## Globe (Mine tab)

- `SkyGlobe` (`sky-globe.tsx`) is lazy and mounts only while the panel is open on Mine.
- The scene is `sky-globe-scene.ts`. The math is `sky-globe.ts`. Colors are `globePalette` in `sky-palette.ts`.
- A fixed crosshair sits at the center. The point under it is the place.
- Drag, inertia, tap to turn, wheel, pinch and buttons zoom 1x to 6x. Arrow keys move 1 degree, Shift 10.
- It renders on demand, frees everything on unmount and calls `forceContextLoss`. Without WebGL it shows `en.sky.globe.unavailable`.
- While dragging, "Near City, Country" shows in an `aria-hidden` line. The settled `aria-live` line carries the pick.
- The land mask is `src/assets/land-map.webp` (`pnpm land`).

## Logo planets

- `product-mark.tsx` renders `span.logo-planet` with an `aria-hidden` inline SVG. Paths are in `product-marks.ts`, colors in `productPalette`.
- It sits in the `/work` product rows. There is no planet canvas.
