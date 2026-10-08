# Products column, logo planets and a pause button

Date: 2026-10-08. Status: approved design, waiting for the written-spec review.

## Goal

Show the owner's two live products on the card next to the open-source repos, so visitors see that he ships and runs products, not only code. Keep the card compact: no extra height on laptop screens. The products also reach search engines and AI agents.

## Decisions locked with the owner

- Layout "E": two columns under the profile block. Open-source repos on the left, products on the right, same height. Stacked on narrower screens, repos first.
- Heading "2 products" (`{count} products` template, like the repo heading).
- Per product: logo, name, role and year, one line. No live-status dot, no chips.
  - hirista, `https://hirista.app`: "Solo founder · 2026". Line: "Scores your saved jobs and writes the résumé for each." (the site spells it "résumé")
  - Safety Real Time, `https://safetyrealtime.com`: "Co-founder & CTO · since 2022". Line: "Fleet software for trucking: pre-trip checks, live dashboards."
- Logos are "logo planets" drawn by the existing planets canvas. hirista: its dark disc as a planet with the "Scored h" on the front. Safety Real Time: a green planet with its navy truck.
- Logo motion: a "sunrise" on first view (the logo turns in from the night side, 2.4 s), then an endless gentle wobble like the repo planets; hover spins it up like the repo planets.
- A round glass "pause motion" button next to the privacy chip stills all motion on the page and is remembered (WCAG 2.2.2, level A).
- The products also go to JSON-LD, `llms.txt`, a new MCP tool and the GitHub profile README.

Out of scope: a `/cv` page, moving cronfluent, any change to which repos show.

## 1. Layout

- Two columns from `64em` (1024 px) wide. The card grows: `--container-page-max: 68rem` at that width, so columns are about 470 px at 1024 px and about 500 px at 1280 px and up. The profile block (portrait, name, bio, actions) keeps its current widths and stays centred.
- A new wrapper `.card-strips` holds both sections and the planets canvas. At `64em` and wider it is a 2-column grid with rows `auto 1fr` and a `1.5rem` column gap; each section spans 2 rows with `grid-template-rows: subgrid`, so the two headings share one row and both lists share one height. The repo list sets the height; `.product-grid` uses `grid-auto-rows: 1fr` and the product line clamps at 2 lines.
- Below `64em`: stacked, repos then products (same DOM, focus and reading order as the wide layout). Product tiles sit 2 per row from `40rem`, 1 per row below.
- No-scroll gate. Today: `(min-width: 48em) and (min-height: 45em)`. New: `(min-width: 64em) and (min-height: 45em), (min-width: 48em) and (min-height: 75em)`, defined once as `@custom-variant no-scroll` in the block form (`@custom-variant no-scroll { @media ... { @slot; } }`; the parenthesised shorthand splits on the comma and emits a broken selector) and used for the `html` overflow, `#main-content` and the fixed dock. Screens 768 to 1023 px wide and under 1200 px tall scroll like phones. The second branch must fit: measured at 800x1120 the stacked card had 142 px to spare and the products block needs about 150 to 170 px, so the branch starts at `75em` (1200 px) and is checked at 800x1200 and 1000x1200. The existing `max-height` tiers keep tightening the card.
- Height budget: in the two-column layout the card must not get taller than today. Baselines measured on the live site: 1280x720 641 px, 1366x768 659 px, 1440x900 815 px, 1920x1080 886 px. Measure 1024x768 and 1536x864 before the change. Accept within 2 px.

## 2. Product tiles

- `src/components/product-strip.tsx` (server): `<section aria-labelledby="products-heading" data-products>`, an `h2` with the same eyebrow style and rule as the repo heading, then `ul.product-grid > li > .repo-tile.product-tile`.
- Shared with repo tiles: glass, radius `--radius-lg`, hover lift, pointer light and the `--lang`-tinted edge, focus ring, the stretched link (`a.repo-link`, new tab, `rel="noopener noreferrer"`, `aria-describedby` = the shared "Opens in a new tab" note).
- Different from repo tiles: a larger planet slot (`2.75rem`, `2.5rem` at `max-height: 51.4375em`), a muted "role · period" line in place of chips, `--lang` set to the product's `tint` (hirista orange, Safety Real Time green) so the hover edge glows in the brand colour, no stars or forks.
- The "Opens in a new tab" span moves from `RepoStrip` into `CardStrips` and is passed down as `newTabId`.

## 3. Logo planets

### Markup and fallback

- `src/components/product-mark.tsx` (server): `<span class="logo-planet" data-logo={key}>` holding an inline `<svg aria-hidden="true" focusable="false">` of the mark in a disc. Each path carries `data-ink="mark"` or `data-ink="accent"`. The colours come from inline custom properties `--logo-disc`, `--logo-mark`, `--logo-accent`, set from `productPalette` in `theme.ts`.
- This flat mark is the fallback (no JS, no WebGL, software renderer, context loss, forced colours, print) and the source the canvas reads, so the path data ships once.
- `[data-planets="gl"] .logo-planet` hides the flat mark once the first WebGL frame is drawn; a 300 ms opacity cross-fade hides the swap. The first WebGL frame is the night-side pose, so the sunrise follows on screen.

### Canvas

- One stage, one canvas. `RepoPlanetsCanvas` moves into `.card-strips`; it already uses `canvas.parentElement` as the stage, so it needs no change. `repo-planets.ts` finds `.repo-planet` and `.logo-planet` nodes, and sets `data-planets` on the stage element itself (today it uses `stage.closest("[data-repos]")`, which would miss the new wrapper; the CSS selector changes to match).
- `src/lib/logo-planet.ts` (client): `createLogoPlanet(node, sphere)` returns the mesh, its uniforms and a dispose function.
  - Signature: `createLogoPlanet(node, sphere, renderer)`; the renderer gives the max anisotropy.
  - Mask: read the node's `svg` `viewBox`, the mark group's transform (`g.transform.baseVal.consolidate()`, applied with `ctx.setTransform` scaled to the canvas, because `Path2D` ignores ancestor transforms) and the `path[data-ink]` elements, draw them with `Path2D` into a 256x256 canvas, mark ink in the red channel and accent ink in the green channel (`globalCompositeOperation = "lighter"`). `CanvasTexture`, `NoColorSpace` (it is data), anisotropy `min(4, max)`, `LinearMipmapLinearFilter`, as in `city-globe.ts`.
  - Material: one `ShaderMaterial` per logo, one draw call. It reuses the planet lighting (sun, terminator, night tint, rim, breathing) and prints the mask on the front hemisphere: `uv` from the spun object position, only where `q.z > 0`. Colours `uDisc`, `uMark`, `uAccent` come from the CSS custom properties, the same way `--lang` is read today. On the night side the logo stays faintly visible. The view vector is `vec3(0, 0, 1)` (orthographic camera), so the rim does not depend on the tile position. The repo planets get the same fix (today `vView` comes from the view position, `repo-planets.ts:91`), so logo and repo rims match; check the repo planets visually after it.
  - If the mask cannot be drawn, the canvas throws and the whole strip falls back to CSS, as it does for a software renderer.
- `src/lib/logo-motion.ts` (pure, tested): `createLogoMotion`, `stepLogoMotion(state, dtMs, { hotGoal, started })`, `settleLogoMotion`, `logoSpin`.
  - Sunrise: spin from -1.9 rad to 0, ease-out cubic, 2.4 s. Sign convention: the shader maps `q = R(uSpin) p` (`repo-planets.ts:113`), so the logo centre sits at object position `(-sin s, 0, cos s)`; with the sun at `(-0.6, 0.55, 0.58)` (`:118`), `s = -1.9` puts it at `(0.95, 0, -0.32)`, `n·sun ≈ -0.75`, on the night side. (`+1.9` would put it on the lit left limb.) It starts the first time the logo is 60% visible while the canvas runs (one `IntersectionObserver` per logo).
  - Wobble after the sunrise: plus or minus 0.35 rad, period about 9 s. Never a full turn.
  - Hover or `:focus-visible` inside the tile: wobble speed times 3.4, amplitude at most 0.5 rad, and the `uHot` glow, eased like the repo planets.
  - Hold, pause, freeze or reduced motion: an unfinished sunrise snaps to the rest pose (0 rad) with one draw.
- Reduced motion: one still WebGL frame at the rest pose, as the repo planets do. Save-Data and software renderers: the flat marks.
- Dispose the textures and materials with the rest.

### Data

- `src/lib/product-marks.ts`: `productMarks[key] = { viewBox, transform?: { x, y, scale }, layers: { d, ink }[] }`.
  - hirista: viewBox `0 0 24 24`, transform `translate(1.22 2.06) scale(0.88)`, bar `M6 3.5H10.6V9.5L7.6 6.5H6Z` (mark), hook `M7.6 7.8L10.6 10.8A5.2 5.2 0 0 1 18 15.51V19.1H15V15.51A2.2 2.2 0 0 0 10.6 15.51V19.1H7.6Z` (accent).
  - Safety Real Time: the 6 paths of `https://safetyrealtime.com/wp-content/uploads/2022/11/srt_logo.svg` (viewBox `0 0 100 57`), all `mark` ink, placed centred at about 74% of the disc width.
- `theme.ts`: `productPalette` = hirista `{ disc: "#1c1410", mark: "#efebe2", accent: "#f79900", tint: "#f79900" }`, Safety Real Time `{ disc: "#32d74b", mark: "#1f232c", accent: "#1f232c", tint: "#32d74b" }`. `tint` drives `--lang` and the rim glow. The source SVG is white; navy on green follows the brand's own favicon.

## 4. Pause motion

### State

- `html[data-motion-paused]` plus `localStorage["motion-paused"] = "1"`, removed on resume. Storage errors make it session-only.
- Module ownership (no import cycle; `import-x/no-cycle` and knip `cycles` would fail): `scene-hold.ts` owns `sceneHoldEvent`, the hold attribute and `motionPausedAttribute`, and `isSceneHeld()` reads both attributes. `motion-pause.ts` imports from `scene-hold.ts`, never the other way.
- `src/lib/motion-pause.ts`: the storage key, the event `motion:pause`, the head script string, `isMotionPaused()`, `setMotionPaused(paused)` (attribute, storage, then dispatches `scene:hold` and `motion:pause`), `subscribeMotionPause(callback)` (a `storage` event from another tab also sets the attribute and dispatches both events, so other tabs follow), and `stillQuery()`: an object shaped like a `MediaQueryList` whose `matches` is "reduced motion or paused" and which fires `change` for either.
- `scene-hold.ts`: `isSceneHeld()` becomes "held or paused". The globe's `holdScene(false)` on close can no longer undo a user's pause.

### Before paint

- One plain inline `<script>` in `<head>` (`dangerouslySetInnerHTML` in `layout.tsx`) sets `data-js`, `data-privacy-ack` and `data-motion-paused` from storage. It replaces the `next/script` `beforeInteractive` script, which Next 16 emits as `self.__next_s.push(...)` at the end of `<body>` and runs only after its main chunk (`node_modules/next/dist/client/app-bootstrap.js`), so it did not run before paint. This also fixes the privacy chip flash for returning visitors and makes the CLAUDE.md claim true. The CSP already allows inline scripts.

### What stops

- Canvases (sky, clouds, repo and logo planets, name tear) already stop and keep their last frame when `isSceneHeld()` is true. Sky and clouds switch from wall-clock time to an accumulated clock (sum of frame times), so they resume where they stopped instead of jumping forward.
- DOM loops take their reduced-motion path through `stillQuery()` in place of `matchMedia(reducedMotionQuery)`: `name-glitch`, `cursor`, `contact-links`, `pill-aurora`, `download-ring`, `intro`, `portrait-effects`, `portrait-expand`, `scroll-motion`, `city-globe`. The canvases keep `reducedMotionQuery`: `space-background.tsx`, `clouds.ts` and `repo-planets.ts` stop through `isSceneHeld()` and report `paused`; moving them to `stillQuery()` would snap the clouds to a fixed pose and report `static`.
- CSS: `@custom-variant still { @media (prefers-reduced-motion: reduce) { @slot; } :root[data-motion-paused] & { @slot; } }`. Allowed forms only (tested with the repo's Tailwind 4.3.3): `@variant still` nested inside a rule with a single selector and no pseudo-element. Never a top-level `@variant still { ... }` (it emits `:root[data-motion-paused] :scope .x`, which never matches), never inside a selector list that contains pseudo-elements (the optimizer drops them, e.g. `.name-signal::before/::after`, `.globe-fill::after`). Those cases, and the universal reset (`*, *::before, *::after` with `0.01ms` durations), get hand-written `:root[data-motion-paused]` copies. Verify the built CSS: no `:scope`, and every reduced-motion selector has a paused twin.

### The button

- `src/components/motion-toggle.tsx` (client): `<button aria-label="Pause motion" aria-pressed>`; the name never changes, the pressed state does. State from `useSyncExternalStore(subscribeMotionPause, isMotionPaused, () => false)`.
- Look: a `2rem` round glass face (same glass as the privacy chip) inside a `2.75rem` hit area, `lucide:pause` and `lucide:play` icons swapped by CSS on the root attribute, so the icon is right before hydration. Focus ring and fade-up on the face. Forced colours: `ButtonFace`/`ButtonText`, `Highlight` when pressed.
- Tooltip: the `.contact-tip` look, placed with CSS above the button and centred (the dock sits at the bottom; `placeTip` in `contact-links.ts` stays private to the actions row), text from `en.motion`, linked with `aria-describedby`, dismissed by Escape.
- Hidden without JS (no `data-js`) and under OS reduced motion, where nothing is left to pause.
- `src/components/page-dock.tsx` (server): `<footer class="page-dock">` holding the toggle and the privacy note. The fixed and in-flow positioning moves from `.privacy-note` to `.page-dock`; the privacy-ack rule hides only the chip, so the button stays. `privacy-note.tsx` renders a `div` root. Print hides `.page-dock`, as it hides `.privacy-note` today.

## 5. Data and other surfaces

- `src/lib/products.ts` (build time; relative `./x.ts` imports so `src/profile/cli.ts` can load it): `Product { key, name, url, schemaType, applicationCategory }`, `products`, and `productLlmsLines(items)`. Text from `en.products.items[key]` (`role`, `period`, `line`). Hand-written on purpose: the CV feed's `projects` has no role, logo, colour or category, and a résumé edit must not reshape the card.
- `i18n.ts`: `en.products` (`headingOne`, `headingOther`, `items`, `llmsHeading`), `en.motion` (button label, tooltip lines). No em dashes, no taglines.
- JSON-LD (`structured-data.ts`): one node per product, `@id` `${website}/#product-${key}`, `WebApplication` for hirista and `SoftwareApplication` for Safety Real Time, `name`, `url`, `description` (the tile line), `applicationCategory`, `creator` = the person's `@id`. No dates (they describe his role, not the product), no Organization nodes, never `worksFor`. No `offers` or ratings: Search Console may list these items as not eligible for software rich results; that is accepted, no rich result is the goal.
- `llms.txt`: a "## Products" section after the open-source projects: `- [name](url): role · period. line`. The résumé's projects section skips any project whose `websiteUrl` host matches a product, so hirista is not listed twice.
- `/mcp`: a sixth read-only tool `products` that returns the "## Products" section of `llms.txt` (same pattern as `projects`), "Not available" when missing. Tests updated. The `projects` tool keeps the résumé projects from `cv.json`, so hirista can appear in both tools; that is accepted (one lists résumé projects, the other the products).
- Profile README (`src/profile/*`): a "## 2 products" section after the repos, built from `products` and `i18n`, links only. No reachability checks for the product sites (external hosts would make `pnpm check` flaky).
- `pnpm icons` adds `lucide:pause` and `lucide:play`. It loads every set in use, so install `@iconify-json/circle-flags`, `@iconify-json/lucide` and `@iconify-json/simple-icons` first and remove them after.
- Modules that `node --test` loads (`products`, `logo-motion`, `motion-pause`, `scene-hold`, `structured-data` and what they import) use relative `./x.ts` imports: `node --test` has no `@/` alias.
- CLAUDE.md: the products column, layout E and the new no-scroll gate, logo planets, the pause button and dock, the head script (and the corrected "before paint" note), new files in the Layout list, the sixth MCP tool.

## 6. Testing and proof

Unit tests (`node --test`):

- `products`: https URLs, unique keys, every key has i18n text, line at most 80 characters, `llms` lines.
- `logo-motion`: rest pose when still; the sunrise moves less than 0.15 rad per 33 ms frame; after the sunrise the spin stays within 0.5 rad for random hover and frame-time sequences; no change without steps.
- `motion-pause`: the head script run in `node:vm` with working, empty and throwing storage; the `stillQuery` truth table and its events; `isSceneHeld` is "held or paused".
- `structured-data`: one node per product, `creator` points at the person, no `worksFor` anywhere.
- `llms.txt`: the Products section, and hirista not listed twice.
- `/mcp`: six tools; `products` returns only its section, or "Not available".
- Profile README: exact expected output.

Browser checks (scripts outside the repo, `~/powertools`):

- No-scroll sizes 1280x720, 1366x768, 1440x900, 1536x864, 1920x1080: card height equals the baseline within 2 px, no scroll, both column bottoms line up within 1 px.
- Band sizes 768x1024, 820x1180, 1024x768, 1180x820 follow the new gate; 800x1200 and 1000x1200 fit without scrolling and the footer clears the dock.
- Phones 320 to 430 px: no horizontal overflow, tap targets at least 24 px, dock after `main`. Zoom 200% and 400% reflow.
- axe 0 violations at three sizes; Lighthouse with CLS 0 and no console errors; contrast of the product names, role line and heading measured by hand over the sky, clouds running and paused, at 1024, 1280 and 1366 px wide (the wider card changes the clouds' dimming, which uses the card-to-viewport width ratio).
- Pause: sky and clouds report `paused`; no animation-frame callbacks for 3 s; no `data-glitch` for 20 s; after a reload the page is paused before first paint; resume continues without a jump; works after privacy OK; keyboard and forced colours.
- WebGL: the sunrise plays once per page view; wobble and hover look right; `WEBGL_lose_context`, a software renderer and Save-Data fall back to the flat marks.
- `pnpm check` passes.

## 7. Risks and notes

- The no-scroll range changes: 768 to 1023 px wide screens under 1120 px tall now scroll. Approved with the design.
- "since 2022" is hand-written on the tile; the fleet popover reads its period from the hirista feed. If they drift, take the tile's period from the feed later.
- The Safety Real Time mark is that company's logo; the owner co-founded it and asked for it.
- A raw `<script>` in `<head>`: check `next dev` for React warnings.
- The sky and clouds clocks change; check the shooting star and twinkle timing after the change.
