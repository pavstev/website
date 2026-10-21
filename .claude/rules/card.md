---
paths:
  - "src/pages/index.astro"
  - "src/pages/404.astro"
  - "src/layouts/Base.astro"
  - "src/styles/globals.css"
  - "src/styles/card.css"
  - "src/components/profile.tsx"
  - "src/components/portrait.tsx"
  - "src/components/portrait-expander.tsx"
  - "src/components/compound-text.tsx"
  - "src/components/download-button.tsx"
  - "src/components/resume-tip.tsx"
  - "src/components/contact-links.tsx"
  - "src/components/card-sections.astro"
  - "src/pages/work.astro"
  - "src/lib/work.ts"
  - "src/components/repo-strip.tsx"
  - "src/components/repo-tags.tsx"
  - "src/components/product-strip.tsx"
  - "src/components/site-footer.astro"
  - "src/components/footer-contacts.tsx"
  - "src/components/motion-switch.astro"
  - "src/components/sky-controls.tsx"
  - "src/components/topic-*.tsx"
  - "src/components/industry-panel.tsx"
  - "src/lib/home-effects.ts"
  - "src/lib/bio.ts"
  - "src/lib/industries.ts"
  - "src/lib/name-glitch.ts"
  - "src/lib/name-tear.ts"
  - "src/lib/portrait-*.ts"
  - "src/lib/contact-links.ts"
  - "src/lib/cursor.ts"
  - "src/components/card-actions.tsx"
  - "src/components/ui/tooltip.tsx"
  - "src/components/ui/loading-button.tsx"
  - "src/lib/tooltip-store.ts"
  - "src/lib/tip-place.ts"
  - "src/lib/intro.ts"
  - "src/lib/anchored-popovers.ts"
  - "src/lib/products.ts"
  - "src/lib/product-marks.ts"
  - "src/lib/resume-facts.ts"
---

# The card

Siblings: `motion.md`, `sky.md`. Colors and tokens are in `src/styles/tokens.css` (`docs/theming.md`).

## Order and size

- Top to bottom: portrait, name, summary, PDF button with three contact links, the section row, then the footer under a faint gradient divider.
- The card is one screen. From 1024x720 up it does not scroll (`no-scroll` gate in `globals.css`). Other screens scroll like a phone.
- Write the `no-scroll` variant in block form only: `@custom-variant no-scroll { @media ... { @slot; } }`.
- Nothing may be cut off at 160x346, 195x422 or 390 wide with a 200% root font.
- Use container queries, not media queries, for layout that must follow zoomed text.
- The footer has no shadow and no dark box. The copyright takes `text-sky` (see `sky.md`).

## Portrait

- 154 px, smaller on phones and short screens. Click opens a dialog where the 800 px image grows out of the card photo and stays a circle.
- The dialog is a flat 80% stone scrim with no blur, a hairline ring, and a 32 px close button on the rim with a 44 px hit area.
- A dither lens follows the mouse, or the finger after a 320 ms press and hold. A short tap still opens the dialog.
- Inside the lens the photo is magnified 1.6x, cut into 2 px cells and mapped to four tones with a 4x4 Bayer dither. A one-cell outline and a dithered halo ring it.
- At rest a one-cell outline sits on the photo edge and a dithered halo pulses outside it (`portrait-halo.ts`, 15 fps).
- The dialog photo gets the same outline and halo with 1.5x cells. Lens code is shared (`wireLens`).
- No lens under reduced motion, Save-Data or a software renderer. No orbit ring. No WebGL context.

## Name

- Geist 600, `--text-display-size` times 47/44, tracking -0.03em. The size shrinks below about 236 px wide.
- Letters are `aria-hidden` spans grouped per word, next to an `sr-only` copy.
- A CSS "signal tuning" intro runs once at first paint and stays readable after about 1 s.
- `name-glitch.ts` then runs a 0.6 s burst every 8 s. It rests after 30 s without input. It sets `data-tuned` first so the intro never replays.
- Each burst is a WebGL tear (`name-tear.ts`) in the live ink color. A burst never moves the layout.
- Reduced motion, forced colors, software renderers and a paused scene skip the tear. Keep every flicker under three flashes a second.
- No axis-morph warp. No blue or violet glow.

## Contact links and PDF button

- Email, GitHub, LinkedIn and the PDF button are `.keycap-host` buttons: 36 px, 44 px hit area, 9 px radius, Geist 13 px weight 500, 15 px icons.
- Focus is a 2 px `--focus` ring right around the cap. Press sinks the cap 1 px and scales it to 0.97.
- They get the proximity zoom from `cursor.ts` (`[data-proximity]`). `cursor.ts` owns the host's `transform`.
- The PDF button has four faces: idle, pending, success, error (`loading-button.tsx`). The faces crossfade in one grid cell, so the row never reflows.
- A click fetches `/resume.pdf` for at least 450 ms. Ctrl or Cmd click stays native. A `role="status"` line says the state.
- The actions row is a size container. The icons wrap 2 + 1 under `8.25em`. The PDF label wraps under `10.25em`.
- Every button has a tooltip in one Tooltip Group (`CardActions`, `ui/tooltip.tsx`, timers in `tooltip-store.ts`).
- First tip after 200 ms, next ones at once while warm. Pointer down and Escape dismiss. The tip stays open while hovered. Touch never opens it.
- The tip is `role="tooltip"`, a small floating surface, at most 220 px wide, Geist 12 px. No shadow.
- `placeTip` (`tip-place.ts`) places it with `contactAvoid`. It prefers covering a button over covering text and keeps 8 px clear of the bio.
- The PDF tip shows a small paper page with the page count and size read from the built PDF (`resume-facts.ts`).

## Sections

- Under the contact row, `ul.section-row` holds three keycaps: About, Work, Blog. Icons are lucide `user-round`, `briefcase`, `notebook-pen`.
- They are plain links with no `data-astro-reload`. Each is a client navigation that plays the home to blog sky shot.
- The row wraps centered. `--card-gap-sections` is 0.75rem. The actions row is `z-2`, above the section row, so a tip draws over the section buttons.
- The home has no drawers. An old `/#projects` link just opens the home.

## Bio topics

- `splitBio` (`bio.ts`) cuts the summary around four words: fintech, betting, healthtech, fleet logistics. A missing word fails the build.
- Each word is a `topic-trigger` button that opens its `topic-panel` (`popover="auto"`). Industry panels show the company and period from `cv.json`.
- On fine pointers a trigger also opens on hover and pins on click, only where the panel floats.
- A company with no valid http(s) link shows its name without one. 167Pluto falls back to its LinkedIn page.
- At rest a word is white, weight 500, with a dotted gray underline. On hover, focus and open it shows its topic gradient with a soft glow. No rainbow at rest.
- By day the hover fill mixes into `--ink-dark`, not white. Forced colors give `LinkText` with an underline.
- Panels are floating surfaces (`.mat-pop`), 11 px radius, 12 px padding, Geist, 13 px text. Forced colors give a 1 px `CanvasText` border.
- Panel motion is CSS only: scale from 0.95 with a 6 px slide from the trigger, exit in 130 ms. Reduced motion and the pause leave only the fade.
- `anchored-popovers.ts` writes `data-side` and `--pop-origin`. It keeps `data-floating` until exit animations finish.
- Coarse pointers get a 44 px tall hit band per trigger.

## Control look (D2 soft tint)

- All controls on every page share one look: fill white 16%, edge white 15%, no gradient, no top highlight, no shadow. Tokens are `--glass-*` in `tokens.css`.
- Small controls: `.keycap`, `.mat-cap`, `.privacy-chip-face`, `.sky-trigger`, `.motion-switch-button`, `.privacy-ack`, `.post-tag`, pagination links, `.lightbox-button`.
- Only the first five blur the backdrop. Each blur is a per-frame read of the WebGL canvas, so do not add one without measuring.
- Floating surfaces (`.tip-surface`, `.mat-pop`, `.drawer-panel`, `.lightbox-caption`) use the float fill with a 10 px blur.
- Neutrals are cool (`--cool-*`). Text in floats uses the stronger muted inks. Inside the sky panel `--ui-ink-2` and `--ui-ink-3` are `--ui-ink`.
- Home day mode (dark ink) remaps the `--ui-*` tokens on controls to dark values. A bright sky with light ink sets `data-lit` and a stronger fill.
- Fallbacks: no `backdrop-filter` or `prefers-reduced-transparency` gives solid fills. Forced colors give `ButtonFace` and `ButtonText`.
- Never put an opacity or `filter` animation on a parent of a glass element: its `backdrop-filter` sees nothing. Motion tips end with `filter: none`.
- Playwright WebKit draws no backdrop blur. Check the blur in real Safari.
- Do not lower `--primary` or `--muted-foreground` contrast.

## Footer

- One component, `site-footer.astro`, two layouts. No `·` separators.
- Home: tier 1 is `© year name`. Tier 2 is the `SkyControls` pill and the credit link "Weather: Open-Meteo". "Open-Meteo" never breaks at its hyphen.
- The credit is required by the CC BY 4.0 licence and shows on the home only.
- Night pages (`links`): one row under the gradient line. Left: `© year name` and the Motion switch. Right: `FooterContacts`, five 32 px keys.
- The keys are GitHub, LinkedIn, Email, Résumé and RSS (RSS only while the blog is live). They share `ContactKey` and `contactEntries` with the home links.
- Each key has an `aria-label`, a tone dot, a tooltip, `rel="me noopener noreferrer"` on external ones and a new-tab note.
- Under `42em` of footer width the row stacks centered. No pill, credit or weather on night pages.
- The night footer is a `<footer>` rendered once by `BlogLayout.astro`, after the page slot and outside `main`. No page renders its own.
- The home footer stays inside `main`, so it has no landmark role.

## Sky pill and panel

- The pill is `button.sky-trigger` (`popovertarget="sky-panel"`, `aria-haspopup="dialog"`) with a sun-moon icon, the fixed label "Play with the sky" and a chevron.
- The accessible name starts with the visible label. A shine sweeps across every 7 s. The icon turns half a turn after each shine. Both pause while open.
- The panel is titled "Whose sky?". It has three tabs, Stevan's, Mine and Custom, then the Motion switch, with full-width hairline rules between rows.
- Tabs are a WAI-ARIA tab list with manual activation (`sky-tabs.ts`). The start tab is Custom while a preview is set, else Mine for a visitor place, else Stevan's.
- Stevan's resets the place and preview and shows a live readout. Mine shows the globe, the place line, "Use my precise location", the privacy line and the GeoNames credit.
- Custom shows the Time and Weather ranges. Leaving it resets the preview.
- `SkyControls` is `client:idle={{ timeout: 1000 }}`. The pill is a native popover button, so a click before hydration still opens the panel.
- The panel floats 10 px above the pill from `(min-width: 40rem) and (min-height: 34rem)`, 22rem wide. Below that it is a full-width bottom sheet.
- Escape and an outside click close it. Focus goes back to the pill, also in WebKit.

## Work page

- `work.astro` uses `BlogLayout`, `BlogHeader` and the blog column. Products come first (`#products`), then Open source projects (`#projects`).
- `src/lib/work.ts` is the one place to configure the page: `productKeys`, `repos.pinned`, `repos.hidden`, `repos.max`.
- Cards and rows are glass cards (`.mat-panel`, `--glass-card`). Hover or focus turns the edge to the accent.
- Every card and row is one stretched link that opens in a new tab. The CSS lives in `blog.css` (`.work-*`, `.repo-*`, `.logo-planet`).
- The first repo is the featured card, full width. The others sit in a grid: 3 columns from 52em of container width, 2 from 34em, 1 below.
- Cards show the name, the full description, tech tags, stars and forks (only above 0).
- Tech tags (`tech-tag.tsx`) are plain: a simple-icons logo and the name, no box. Language logos use the GitHub Linguist color. Topics map through `topicTech` in `tech-logos.ts`.
- A technology with no logo gets a 6 px dot. Topics that are not technologies are dropped. A new technology needs a `topicTech` entry and `pnpm icons`.
- Product rows show the logo mark, name and line, and a side column with role, period and the bare domain. Under 36em the side column moves under the text.
- The "All on GitHub" link sits at the right end of the projects heading row.
- No WebGL and no island on the page.

## 404

- `404.astro` is `noindex`, on `BlogLayout`. It shows "Page not found" and one "Back to home" link with a 44 px hit area.
- It never scrolls from 160x346 to 1920x1080. Its console shows one "Failed to load resource" line: the page's own 404.

## Touch and screen readers

- `aria-expanded="false"` is in the static HTML of `button.topic-trigger`, `button.sky-trigger` and `button.privacy-chip`.
- A skip link (`skip-link.astro`) is the first child of `<body>` in both layouts.
- On `(pointer: coarse)` the footer pill and the credit link get a 44 px hit band. `.name-letters`, `.sky-controls` and the privacy panel carry `data-nosnippet`.
- Axe by day reports false contrast fails on the card and the open panel. Run axe at night for the 0-violation gate and measure the day by pixels.
