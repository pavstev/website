---
paths:
  - "src/pages/index.astro"
  - "src/pages/404.astro"
  - "src/pages/500.astro"
  - "src/components/error-page.astro"
  - "worker/router.ts"
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
  - "src/components/work-grid.tsx"
  - "src/lib/work-controls.ts"
  - "src/components/repo-tags.tsx"
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

Siblings: `motion.md`, `sky.md`. Tokens are in `src/styles/tokens.css` (`docs/theming.md`).

## Layout

- The card is one screen. From 1024x720 up it does not scroll (`no-scroll` gate in `globals.css`). Other screens scroll like a phone.
- Write the `no-scroll` variant in block form only: `@custom-variant no-scroll { @media ... { @slot; } }`.
- Nothing may be cut off at 160x346, 195x422 or 390 wide with a 200% root font.
- Use container queries, not media queries, for layout that must follow zoomed text.
- The footer has no shadow and no dark box. The copyright takes `text-sky` (see `sky.md`).

## Portrait and name

- The portrait dialog scrim is flat, no blur. The lens follows the finger after a 320 ms press and hold; a short tap still opens the dialog. Lens code is shared (`wireLens`).
- No lens under reduced motion, Save-Data or a software renderer. No orbit ring. No WebGL context for the portrait.
- `name-glitch.ts` sets `data-tuned` first so the intro never replays. The tear is skipped under reduced motion, forced colors, software renderers and a paused scene. Keep every flicker under three flashes a second.
- No axis-morph warp. No blue or violet glow.

## Contact links and tooltips

- The contact links are `.keycap-host` buttons. `cursor.ts` owns the host's `transform` (proximity zoom).
- The PDF button faces crossfade in one grid cell, so the row never reflows. Ctrl or Cmd click stays native.
- Tooltips share one Tooltip Group (`CardActions`, `tooltip-store.ts`). Touch never opens them. `placeTip` prefers covering a button over covering text and keeps 8 px clear of the bio.
- The actions row is `z-2`, above the section row, so a tip draws over the section buttons.
- The section links (About, Work, Blog) have no `data-astro-reload`: each is a client navigation that plays the home to blog sky shot.

## Bio topics

- `splitBio` (`bio.ts`) cuts the summary around four words: fintech, betting, healthtech, fleet logistics. A missing word fails the build.
- Each word is a `topic-trigger` button that opens its `topic-panel` (`popover="auto"`). On fine pointers it also opens on hover and pins on click, only where the panel floats.
- A company with no valid http(s) link shows its name without one. 167Pluto falls back to its LinkedIn page.
- At rest a word is white with a dotted gray underline. No rainbow at rest. By day the hover fill mixes into `--ink-dark`, not white.
- `anchored-popovers.ts` keeps `data-floating` until exit animations finish.

## Control look (D2 soft tint)

- All controls on every page share one look: fill white 16%, edge white 15%, no gradient, no top highlight, no shadow. Tokens are `--glass-*`.
- Only `.keycap`, `.mat-cap`, `.privacy-chip-face`, `.sky-trigger` and `.motion-switch-button` blur the backdrop. Each blur is a per-frame read of the WebGL canvas, so do not add one without measuring. Floating surfaces use a 10 px blur.
- Home day mode (dark ink) remaps the `--ui-*` tokens on controls. A bright sky with light ink sets `data-lit`.
- Never put an opacity or `filter` animation on a parent of a glass element: its `backdrop-filter` sees nothing. Motion tips end with `filter: none`.
- Playwright WebKit draws no backdrop blur. Check the blur in real Safari.

## Footer

- One component, `site-footer.astro`, two layouts. No `·` separators.
- Home: `© year name`, the `SkyControls` pill and the credit link "Weather: Open-Meteo" (required by CC BY 4.0, home only). "Open-Meteo" never breaks at its hyphen.
- Night pages: one row, full width minus `--container-px` each side (see `blog.md`). Left: `© year name` and the Motion switch. Right: `FooterContacts`. Under `42em` the row stacks centered. No pill, credit or weather.
- The night footer is a `<footer>` rendered once by `BlogLayout.astro`, after the page slot and outside `main`. No page renders its own.
- The home footer stays inside `main`, so it has no landmark role.

## Sky pill and panel

- The accessible name of `button.sky-trigger` starts with the visible label "Play with the sky".
- Tabs are a WAI-ARIA tab list with manual activation (`sky-tabs.ts`). The start tab is Custom while a preview is set, else Mine for a visitor place, else Stevan's. Leaving Custom resets the preview.
- `SkyControls` is `client:idle={{ timeout: 1000 }}`. The pill is a native popover button, so a click before hydration still opens the panel.
- Escape and an outside click close the panel. Focus goes back to the pill, also in WebKit.

## Work page

- `work.astro` uses `BlogLayout`, `BlogHeader` and a full-width `.page-wide` index (see `blog.md`). One grid (`work-grid.tsx`) holds products and open source repos in the same `.work-card` style (owner picks A1 B1 C2 D3, 2026-10-29). There is no Stories section: the stories are reached from the repo cards.
- `src/lib/work.ts` configures the page and owns the view logic (`parseWorkView`, `workViewSearch`, `sortWork`). The `.work-*`, `.repo-*`, `.logo-planet` and `.work-mark*` CSS lives in `work.css`, imported by `work.astro`.
- Featured is the default sort: config order, products first. Stars, Recently updated (`pushed_at`) and A to Z mix products and open source (owner, 2026-10-30).
- The filter is the shared tab strip (`.tab-strip` in `controls.css`, `tab-strip.ts`), the interior.dev underline tabs in our look (owner, 2026-10-30): All, Products, Open source with counts, a hairline under the whole controls row, a soft hover fill, the active tab bright and semibold (width reserved by `data-text`), and one 2px `--primary` bar that slides to it. They are radio inputs. The filter is CSS only (`.work-view:has(...:checked)`), so it works without JavaScript; then the active tab draws its own bar. It shows only when both kinds exist.
- The sort is the shared `SelectMenu` (`ui/select-menu.tsx`, `select-menu.ts`, styles in `controls.css`): a glass pill with the arrows icon, the chosen label and a chevron, opening a `role="listbox"` popover (`data-anchored="always"`). Under a 40rem container it shrinks to the round 32 px icon, and a blue dot shows when the order is not Featured. No native `<select>` (owner, 2026-10-30).
- `work-controls.ts` sorts by moving the DOM nodes (never CSS `order`, so the focus order matches), writes `?show=` and `?sort=` with `history.replaceState`, and announces "Showing N of M" in a polite status. A bad value falls back to the default and leaves the address. The sort icon stays hidden until the script sets `data-ready` on `[data-work]`.
- Motion (owner, 2026-10-30): a filter or sort change plays a FLIP (`flip.ts`, transform only, so glass keys keep their blur): moved cards slide from their old place, cards that come back lift in. The snapshot is taken on `pointerdown` or `keydown` on the strip, before the CSS filter applies. Hover: the card edge brightens, the name underline fades in, the GitHub mark grows a little. All of it stops under reduced motion and the Motion switch.
- Each card head: the name link (new tab) with the kind label ("Product" or "Open source") under it, centered against the right tools. A product shows its mark there; a repo shows its stars and the GitHub key. A product foot is the site key (`.work-site-link`, new tab, the host name). No platform text.
- Only the name and the action keys are links. The card body has no pointer.
- GitHub key (owner, 2026-10-24): a plain blue mark at the right end of the title row, no keycap, no frame, exactly one title line high (`1.3em` at `--fs-base`), with a 44 px hit area (`.repo-key-link::after`).
- Its tooltip is static markup (`.repo-tip.tip`), because the grid is not hydrated. `repo-tips.ts` hides it on Escape until the pointer or focus leaves.
- A repo in `workConfig.repos.stories` adds the "See the story" key `.work-story-link` (same tab, `data-story-link`, owner pick B2, 2026-10-24).
- The card box and name morph into the story sheet under `html[data-story-morph]` (`story-morph.ts`). Keep `data-story-path` on the card.
- No featured card and no "All on GitHub" card. Each card spans 3 rows of the `.work-grid` as a CSS subgrid (`--card-rows`), so a card without a story or tags keeps the same tag line and bottom as its neighbours. The grid has 1 to 4 columns by container width.
- Tech tags wrap onto as many lines as needed. No "+N more", no clipping, no popover. A new technology needs a `topicTech` entry in `tech-logos.ts` and `pnpm icons`.
- `pnpm dev:many` also fills /work with fake products and repos (`src/lib/work-fixtures.ts`). It reuses `fixturesEnabled()`, so a build or CI run with `BLOG_FIXTURES=1` fails.
- `pnpm test:e2e` (`scripts/site.e2e.ts`) starts its own fixture dev server (`astro dev --ignore-lock` on a free port) and runs headless Chromium over the filter, sort, address, no-JS and failed-script cases and the error pages. It is local only: CI blocks the fixtures.
- No WebGL and no island on the page.

## Error pages

- `404.astro` and `500.astro` both render `error-page.astro` (night style, `noindex`, the path in the lede, links home and to the sections). Copy lives in `en.notFound` and `en.serverError`.
- Neither page scrolls from 160x346 to 1920x1080. The 404 console shows one "Failed to load resource" line: the page's own 404.
- Static assets: Cloudflare serves `404.html` (`not_found_handling`). The Worker routes (`/mcp`, `/where`) catch a thrown error: a browser request gets `/500` with status 500 and `no-store`, an API client gets the JSON `internal` error. Custom error pages for asset failures need a paid plan.
- In `astro dev`, `/500` answers with status 500.

## Touch and screen readers

- `aria-expanded="false"` is in the static HTML of `button.topic-trigger`, `button.sky-trigger` and `button.privacy-chip`.
- On `(pointer: coarse)` the footer pill and the credit link get a 44 px hit band. `.name-letters`, `.sky-controls` and the privacy panel carry `data-nosnippet`.
- Axe by day reports false contrast fails on the card and the open panel. Run axe at night for the 0-violation gate and measure the day by pixels.
