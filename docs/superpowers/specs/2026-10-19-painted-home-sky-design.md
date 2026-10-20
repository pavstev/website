# Painted home sky: design spec

Date: 2026-10-19. Status: built and shipped on 2026-10-19.

## Goal

Replace the home background with a painted, Turner-style sky that follows the real Vienna clock, the live Vienna weather and the real moon, with a Vienna skyline and horizon mist. Only the background changes. No controls on the site. It must stay cheap on the GPU.

## Look references (port these, do not redesign)

- `_ref/painted-home-sky/moon-sky.html`: the exact owner pick with the moon. Its fragment shader and its `scene()` function are the reference for every look value below. Artifact: <https://claude.ai/artifact/32v68LT72MAbtG9hrZh8Pk>
- `_ref/painted-home-sky/painted-sky.html`: the picker with all options (A1 to D4). Artifact: <https://claude.ai/artifact/PjKsPQSgqofGEN7tmr3oa1>
- `_ref/painted-home-sky/stitch_painterly_weather_simulator_background.zip`: the source idea (zip palettes, paper grain, skyline). Only its background was wanted.

`_ref/` is ignored by Prettier and ESLint and excluded from git on this machine (`.git/info/exclude`).

## Owner picks

| Id  | Pick                 | Values                                                     |
| --- | -------------------- | ---------------------------------------------------------- |
| A2  | Turner glaze clouds  | cover 52 (fallback only, see Weather), drift 1.6x          |
| B2  | Real Vienna clock    | dawn, day, golden hour, dusk, night palettes by sun height |
| C3  | Paper grain          | strength 33%                                               |
| D1  | Vienna skyline       | etching (K5): Stephansdom, Karlskirche, Riesenrad, hills   |
| D2  | Horizon mist         | low rolling mist along the bottom                          |
| -   | Moon                 | on, real position and phase, size 100% (true ratio to sun) |
| -   | Live weather         | yes, through our Worker                                    |
| -   | Text on a bright sky | dark ink by day (accepted risk, see below)                 |
| -   | Leaving home         | crossfade in the 1 s shot; at night the moon fades with it |

Rejected in the picker: A1 painted realism, A3 brush strokes, A4 photo real, A5 the zip puffs, B1 night as today, B3 clock kept deep, B4 golden hour, C1, C2, C4, D3 brush ribbons, D4 painted stars.

## Scope

- Home (`/`) only. Blog, `/work` and `/about` keep today's night sky (`longRaysShader`, `blogLook()`), unchanged.
- Social images (`scripts/generate-images.ts`) unchanged.
- `sky-rays.test.ts` stays green: do not touch the two locked swap lines.

## Layers, back to front (as in `moon-sky.html` `main()`)

1. Sky gradient from the clock palette (`u_low`, `u_mid`, `u_top`), sun glow (wide glaze glow), moon glow.
2. Stars: today's round stars (not D4), amount `clamp((-sunAlt - 3) / 7, 0, 1)`, times `1 - overcast`, dimmed by up to 35% under a bright moon.
3. Moon disk (see Moon), then the sun disk with its rays.
4. Overcast deck (weather only).
5. Glaze cumulus: 3 depth layers (`layerOf`: far, mid, near), flat bases, 7 billows per cloud, fbm erosion, 3-step light march toward the light, edge 0.5, erosion 0.5, 2.5 octaves, rim darkening, low-frequency blooms. Light comes from the sun by day, the moon at night when it is up, else from the city glow below.
6. Cirrus veil in the upper half, hidden under overcast.
7. Rain veils or snow flakes (weather only).
8. Etched skyline (owner pick K5 on 2026-10-19: outline and hatching by depth and by the side facing the sun, lines turn light at night; Riesenrad turns slowly), then horizon mist, then fog (weather only).
9. Paper grain at 33% (grain, 4 px dot pattern, contrast 1.18, saturation 1.22), vignette, soft highlight shoulder, dither.

Colors: the six palettes (`dawn`, `noon`, `golden`, `dusk`, `night`, `rain`) and the moon, city and moonlit tints move to `src/lib/theme.ts` as tokens (no hex in the shader or components). The shader gets them as uniforms. Palette blend by sun altitude (degrees): night at -16 or less, dusk at -8, warm at -1 to 5 (dawn before solar noon, golden after), noon at 14 or more, linear between stops (`clockPalette`).

## Sun, moon and view

- Sun: keep `src/lib/sky-ephemeris.ts` (Meeus) and `sunSpot` for the sun.
- Moon: add a pure, tested moon module (`src/lib/sky-moon.ts`): position (altitude, azimuth, distance) for Vienna, illuminated fraction, phase, phase angle, bright-limb direction and the lunar north direction on screen. Accuracy target 0.3 degrees in position against JPL Horizons at 4 or more fixed instants (fixtures in the test). The prototype uses the SunCalc formulas; Meeus chapter 47 (truncated) is fine too.
- Moon drawing: lit by the phase angle on a sphere (terminator, limb darkening), painted maria in their real layout turned to lunar north, Tycho spot, earthshine on the dark part at night, glow scaled by the lit fraction. The dark part shows the sky, never a black disk. Size: true moon to sun ratio times the sun's size on screen.
- Clouds near the moon get a silver lining at night. Moonlit cloud tint mixes toward the moonlit token by `moonUp x darkness x (0.35 + 0.65 x fraction)`.
- View: the sky must show 0 to 72 degrees of height on desktop, horizon at about 6% from the bottom (prototype: 0.88 x height per 72 degrees). By day the view turns so the sun sits right of the card (today's rule). At night it turns so the moon sits there instead. Blend the turn while the sun goes from -2 to -8 degrees, and only when the moon is up. A body outside the view is not drawn. If `sky-view.ts` cannot fit 72 degrees, change its home pitch or field of view, and keep the blog view unchanged.

## Weather (live, through our Worker)

- Worker: new route `GET /weather` in `worker/index.ts` (add `/weather` to `run_worker_first`). It asks Open-Meteo `current=cloud_cover,weather_code,wind_speed_10m,wind_direction_10m,is_day` for Vienna (48.2082, 16.3738), validates with zod, and answers small JSON `{ cover, code, windKmh, windFrom, at }`. Edge cache 15 min with one fixed cache key (no per-visitor misses). Errors: JSON `{ "error": code }`, `no-store`, the same security headers as `/mcp`. Old code to look at: commits `586b5df` (added) and `13287b8` (removed).
- Client: fetch `/weather` once on home load and every 30 min while the tab is visible. No storage. Crawlers, Save-Data and failed fetches get the fallback: partly cloudy, cover 0.52, drift 1.6x, no rain.
- Mapping (pure, tested): cover = `cloud_cover / 100`. Overcast 0.92 for code 3 or cover over 0.85. Fog for 45 and 48. Rain for 51 to 67 and 80 to 82 (drizzle 51 to 57 at half strength). Snow for 71 to 77, 85 and 86. 95 to 99 is rain at full strength, no lightning.
- Under overcast, mix the palette toward `rain`, scaled by daylight (`0.22 + 0.78 x dayness`), dim the sun and moon to a glow, hide the stars.
- Wind: drift = `1.6 x clamp(windKmh / 14, 0.4, 2.5)`. Clouds move with the wind: left or right from the wind direction against the current view direction.
- Credit: Open-Meteo data is CC BY 4.0. Add a visible credit link next to the sky (home footer link line), text in `src/lib/i18n.ts`. `docs/architecture.md` "No weather" says a data source needs this.
- CSP: no change (same origin).

## Text over the sky (accepted risk)

Owner pick: dark ink by day. Risk, said once: it failed on patchy clouds in the 2026-10-13 test. Safety net:

- Per text target (`inkTargets`: name 3, bio 4.5, copyright 4.5), the probe gives the brightest (p98) and darkest (p02) sample.
- Dark ink (a token near `--background`) when its contrast against p02 meets the target. White ink with today's lift otherwise.
- Hysteresis: switch only when the other ink wins by 0.5 contrast on two probe reads in a row. Color change 400 ms.
- If neither ink meets the target (a mixed box), the ink with the better contrast stays. Owner call 2026-10-19: no background behind any home text, so there is no roll-off patch (the earlier `dayKnee` and `dayCeiling` roll-off was removed).
- Buttons and the portrait keep their own styles.

## Leaving home and coming back

- One WebGL context. The painted sky is its own program (`paintedSkyShader`); the blog program stays as it is.
- During the 1 s shot (`tweenMs`), draw the blog sky, then the painted sky over it with alpha `u_paint` going 1 to 0 (ease in and out), while the sun glides to the corner as today. Reverse on the way back.
- At night the moon fades out with the painted sky, and the blog corona grows from the corner as today.
- Outside the shot only one program draws.
- Instant swap under the motion pause, reduced motion, crawlers, Save-Data, a software renderer, a frozen sky, a hidden tab and no WebGL (today's list).

## Speed

- Clouds (cumulus, overcast deck, cirrus) render into a half-size texture at 30 fps at most; the full-size pass composites it with the cheap layers.
- Phones (narrow view or coarse pointer): 2 cloud layers (mid and near), not 3.
- Skip cloud work when cover is under 0.05. Keep today's frame pacing, the 1.4 M pixel cap, idle 30 fps, pause when hidden, freeze after slow frames, still frame for reduced motion, the motion pause and software renderers.
- Compile with `KHR_parallel_shader_compile` (`whenLinked`), no blocking GL calls.
- Budget: no startup long task over 50 ms; home click to paint no slower than today (measure against `main` on the same machine). The perf scripts moved when `~/powertools` was reorganized on 2026-10-19; find them under `~/powertools/tools` first.

## Crawlers and stills

Crawlers keep `crawlerInstant` (a winter night) with the fallback clouds, no weather fetch, and the real moon for that instant. `?at=` still pins the time. Add `?weather=<clear|partly|overcast|rain|snow|fog>` for tests.

## Tests (pure functions)

Palette blend by sun altitude; WMO code mapping; wind to drift and direction; moon position against Horizons fixtures; phase, fraction and bright-limb direction (waxing evening crescent lit toward the set sun); lunar north; view yaw blend; ink choice with hysteresis; Worker `/weather` parse, cache and error paths.

## Docs to update

`.claude/rules/sky.md`, `docs/architecture.md` (replace the "No weather" bullet, add the Worker route), the `CLAUDE.md` layout list (new modules), and a project memory note.

## Defaults (decided without the owner)

- Clouds follow the live wind; an average breeze (14 km/h) gives 1.6x.
- Rain is painted veils plus fine streaks; snow is painted flakes (both as in `moon-sky.html`).
- At night the moon fades with the painted sky in the shot (reading of "moon could go into fade"). If the owner meant a glide to the corner, change only that.
- Weather refresh 30 min on the page, 15 min edge cache.
- Fallback sky: partly cloudy, cover 0.52.
- Credit link in the home footer line.

## Out of scope

Blog sky, social images, any visible control, A3 strokes, brush ribbons, painted stars, lightning, weather on the blog.

## How to build

Branch rules from `CLAUDE.md`: no comments in source, no `any`, no `!`, no hex outside `theme.ts` and `src/styles`, strings in `i18n.ts`, `pnpm check` before done, never deploy by hand. Suggested order: moon module and tests, palette and weather mapping and tests, Worker route, painted program with the cloud buffer, ink mode, the crossfade, docs. Check the result against `moon-sky.html` at noon, golden hour, dusk, a full moon night, a crescent, overcast, rain and snow, desktop and phone width.
