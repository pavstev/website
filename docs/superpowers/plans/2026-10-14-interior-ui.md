# interior.dev migration plan (2026-10-14)

Brief from the owner: explore <https://www.interior.dev/>, download its components, port them (to Astro where it fits) and replace every site component that has an equivalent. The sky, the background, the WebGL and 3D parts stay.

## Source

- interior.dev is a set of 55 MIT React micro-interaction components by ozzy (`github.com/ddoemonn/interior`). Runtime dependency: `motion` (`motion/react`). Most files export a headless hook plus a styled example.
- Downloaded: a full clone at `~/work/interior-ui` (commit 3148008). Read the files in `~/work/interior-ui/components/interior/`. Never run its scripts.
- The repo now depends on `motion` (^12.43). Credit: keep the MIT notice in `NOTICE` (task 7).

## How to port (every lane)

1. Port the interior hook and its motion values (springs, timings, gesture logic) into `src/components/ui/<name>.tsx`, one file per interior component, kebab-case, `.tsx` React. Keep only what the site uses.
2. Render with the site's own markup, class names, tokens and a11y. The interior styled examples use stone colors, hex and bracket classes: do not copy them. Use the tokens in `src/styles/globals.css` and Tailwind paren syntax.
3. Reduced motion and the pause button: use `useStill()` from `src/lib/use-still.ts` (true under OS reduced motion or the pause), never motion's `useReducedMotion` alone. When still, set `transition={{ duration: 0 }}` or skip `initial`.
4. Repo rules hold: no comments, no `any`, no `!`, no eslint-disable, explicit return types on exports, `interface` over `type` for object shapes, UI strings in `src/lib/i18n.ts`, no hex outside `globals.css` and `src/lib/theme.ts`.
5. Delete the CSS, helpers and tests that the port makes dead (knip fails on unused exports and files). Update the matching rule file in `.claude/rules/` and `docs/architecture.md` where a bullet describes the old behavior.
6. Astro where no JS is needed: a static part stays `.astro`.
7. Run `pnpm check` (also the pre-commit hook). One commit per lane, Conventional Commits, no Claude co-author line.

## Map: site part to interior part

| Lane           | Site part                                                                                                                                                                                 | interior part                                           | Notes                                                                                                                                                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Drawers      | `card-drawer.tsx` (projects, products), `blog/toc-drawer.tsx`                                                                                                                             | Drawer                                                  | Keep `<dialog>` + `showModal` (top layer, the "+N" popovers above it), the URL hash state, focus return and the bottom sheet under 40rem. Take the spring slide, scrim fade and drag to dismiss.                                   |
| 2 Popovers     | `topic-panel.tsx`, `industry-panel.tsx`, `city-panel.tsx`, `privacy-note.tsx`, the "+N" in `repo-tags.tsx`, `src/lib/anchored-popovers.ts`                                                | Popover                                                 | Keep `popover="auto"` and the hover pin. Take the origin-aware scale in from the trigger side and the flip on collision.                                                                                                           |
| 3 Card actions | `contact-links.tsx` + `src/lib/contact-links.ts` tips, `resume-tip.tsx`, `download-button.tsx`, `motion-toggle.tsx`, the section links in `card-sections.astro`, `blog/post-date.tsx` tip | Tooltip Group, Loading Button, Icon Morph, Press Depth  | One tooltip group per row: delayed once, instant after, the tip glides between buttons. PDF button: Loading Button states, no layout shift. Pause button: Icon Morph play and pause. Press Depth on the contact and section links. |
| 4 Blog nav     | `blog/toc-spy.tsx`, `blog/bar-spy.tsx`, `blog/blog-header.astro`, `blog/post-toc.astro`, `blog/pagination.astro`                                                                          | Scroll Spy, Sticky Header, Reading Progress, Pagination | The TOC gets one traveling indicator. The bar condenses on scroll and shows reading progress on posts. Pagination stays Astro links with interior's windowed pages and gaps. Do not touch `motion-toggle.tsx`.                     |
| 5 Blog content | `blog/blog-image.tsx`, `blog/post-effects.tsx`, `blog/figure.tsx`, `blog/chart-table.tsx`                                                                                                 | Blur-up Image, Lightbox, Sortable Table                 | Images blur up, zoom opens a lightbox that returns to its place. Chart tables sort with rows that travel.                                                                                                                          |

Kept as they are (no interior equivalent, or 3D, sky or background): `space-background`, `repo-planets-canvas`, `city-globe-*`, `vienna-arms`, `product-mark`, `portrait`, `portrait-expander` (WebGL bead), `effects-init`, `icon`, `profile`, `compound-text`, `topic-heading`, `city-heading`, `site-footer`, `page-dock`, `repo-strip`, `product-strip`, the blog diagrams and charts other than the table, the static blog Astro parts.

## Order

Lanes 1, 3 and 4 run first in parallel, then 2 and 5. Each lane works in its own worktree on top of `feat/interior-ui` and does not touch another lane's files. `globals.css` and `i18n.ts` are shared: edit only your own blocks. The lead merges the lanes, runs `pnpm check`, checks the pages in a browser and opens no PR and no push to `main` (a push to `main` deploys).

## Phase 2: the interior.dev look (owner picks 2026-10-14 22:40)

Owner picks: the interior.dev dark look, flat solid surfaces (no glass blur), all four groups restyled, Geist for interface text, keep the extra JS weight, keep the new small pause icon, tips stay above the contact row with more gap from the bio.

Foundation (commit 12a17a5, in `src/styles/globals.css`):

- Tokens on `:root`: `--ui-bezel` `#141312`, `--ui-panel` `#1d1d1a`, `--ui-well` `#252522`, `--ui-sub`, `--ui-hairline`, `--ui-hairline-strong`, `--ui-ink` `#f8f8f4`, `--ui-ink-2` `#c2c2ba`, `--ui-ink-3` `#93938b`, `--ui-accent` `#93b0ff`, `--ui-accent-soft`, `--ui-moss`, `--ui-flag`, shadows `--ui-shadow-float|lift|well|cap|row`, radii `--ui-radius-sm` 6px, `--ui-radius` 8px, `--ui-radius-lg` 12px, `--font-ui` (Geist Variable, 100 to 900, latin and latin-ext files in `public/fonts`). Tailwind colors `ui-panel`, `ui-well`, `ui-ink`, `ui-ink-2`, `ui-ink-3`, `ui-accent`, `ui-hairline`, `ui-bezel` and `font-ui`.
- Materials in `@layer components`: `.mat-panel` (raised card), `.mat-float` (floats over everything: tooltips, popovers, drawers), `.mat-well` (cut-in slot: inputs, rails, table head), `.mat-cap` (a key with a bottom lip: buttons), `.mat-row` (a picked row: active item), `.ui-text` (Geist, ink).
- interior's own rules (from its `globals.css`): depth is real, never a flat border pretending to be structure. Wells are cut in, panels are lifted, caps have a bottom lip you could press. Text sizes are small and tight (tooltip 11.5px, labels 13px, body 14px), weight 500 for labels. Copy the exact classes of the interior component you port from `~/work/interior-ui/components/interior/*.tsx` dark variants (`dark:` classes) and map each hex or stone class to the tokens above.

Rules for the restyle:

- Every surface you restyle drops `backdrop-filter`, glass gradients, sheens, iridescent rings, metal rings, glows and light sweeps. Use the materials and tokens. Keep the motion that phase 1 added.
- Text that sits on the sky (name, bio, blog prose, headings) is not part of this. Only the parts listed in your lane.
- Contrast: `--ui-ink-3` on `--ui-panel` is about 5.6:1, fine for small text; never put `--ui-ink-3` on `--ui-well` below 14px without checking 4.5:1.
- Focus ring stays `--primary` 2px.
- Forced colors and print keep working: check the existing forced-colors rules for each part still apply to the new classes.
- No hex outside `globals.css`; the tokens are already there. Add a token in `globals.css` only if a value is missing.

| Lane                | Parts                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A Tips and popovers | contact tooltips and the PDF paper tip, the pause tip, the blog date tip (`.tip*`), topic, industry and city panels, the privacy chip and panel, the "+N" tag popover. More gap between the contact tips and the bio (about 8 px clear).                                                                                                                                                           |
| B Drawers           | the drawer panel and scrim (`ui/drawer.tsx`, `.drawer*`, `.card-drawer`, `.toc-drawer` panel), the repo and product tiles inside, the "All repos on GitHub" link.                                                                                                                                                                                                                                  |
| C Buttons           | PDF button, the three contact links, the three section links, the pause disc (corner and bar). Keycaps (`.mat-cap`) with a pressed state; port interior Press Depth's keycap base layer now that the buttons are caps. Drop the aurora, metal and iridescent rings, glow and sweep, and their scripts where dead (`pill-aurora.ts`, the ring part of `contact-links.ts`). Keep the proximity zoom. |
| D Blog parts        | the sticky bar, the TOC rail and its thumb, the TOC list in the drawer, the reading progress line, pagination, the chart data table and its "Show the data as a table" summary (give it a visible marker), the lightbox chrome (caption, zoom and close buttons).                                                                                                                                  |

## Phase 3: pixel perfect (owner 2026-10-14 23:45)

Owner: "Make the port pixel perfect per their guidelines." Picks: interior's exact warm colors (no cool tint), more space above the contact row so the PDF tip clears the bio (about 14 px, the card gets taller), Geist for all site text (done in 9006387: `--font-sans` is Geist Variable with measured Arial fallbacks; Inter stays only for the PDF, share images and profile header), and four extra parts get the look: blog post cards, the blog sidebar, code blocks and notes in posts, the portrait dialog chrome (close button and frame only, the WebGL bead stays).

Method for every lane (measure, do not eyeball):

1. Open interior.dev's own demo of your component in dark mode with your own headless Chrome through playwright-core (`colorScheme: "dark"`; the pages are `https://www.interior.dev/docs/<slug>`; the demo sits in the preview panel). Read the computed styles of each element of the demo: font family, size, weight, line height, letter spacing, color, padding, gap, width and height, border radius, border, background, box shadow, and the motion values in the source file.
2. Read the same values from our component on our dev server.
3. Write both into a table in your lane notes and fix every difference, except where our layout needs a different size (a 44 px touch target can stay invisible through `::after`; a size container rule stays). Colors must match the `--ui-*` tokens exactly; if interior uses a value with no token, add a token in `globals.css`.
4. Screenshot interior's demo and ours side by side at the same scale (2x) and look at them together.
5. interior's site styles (`~/work/interior-ui/app/globals.css`, `components/docs/*`) count as their guidelines for things a component file does not cover: the code block, the card, the sidebar row, the page type scale.
