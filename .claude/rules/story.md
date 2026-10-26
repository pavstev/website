---
paths:
  - "src/pages/work/dotfiles.astro"
  - "src/components/story/**"
  - "src/lib/story/**"
  - "src/lib/story-morph.ts"
  - "src/lib/dotfiles-facts.ts"
  - "src/data/dotfiles-story.ts"
  - "src/styles/story.css"
  - "src/styles/scroll-rail.css"
  - "src/components/scroll-*.astro"
  - "src/lib/scroll-*.ts"
  - "scripts/audit/check-story.ts"
---

# The dotfiles story (`/work/dotfiles`)

Siblings: `card.md` (the `/work` card), `motion.md`, `sky.md`. One page, not a framework: the next project story is its own thing.

## Copy and facts

- Copy lives in `src/data/dotfiles-story.ts`. `src/data/dotfiles-stats.ts` holds `storyMeta.updatedAt` and `skillCatalog`. Move `storyMeta.updatedAt` on every copy or catalog edit: it is the sitemap `lastmod` and the `WebPage` `dateModified`.
- Names, not counts (owner pick 2026-10-22): no line, note, name row or drawing label prints a number. The page names real things instead (tools, rules such as G14, agents, skills, models). The drawing still draws the live counts as shapes, never as digits. A new skill needs an entry in `skillCatalog` (a skill without one shows as new).
- `copy-rules.ts` checks `line` and `note`, each skill's `what` and `flow`, and the poster facts: 3 to 7 words a line (the two titles excepted), 2 to 4 sentences and 55 words a note, no em dash, no banned word, no question, no exclamation mark, no city, no number at all. Strips are real command output and are not checked.
- Facts come from GitHub at build (`dotfiles-facts.ts`). A truncated tree, a missing blob or a count of 0 fails the build, so a moved file shows up at once.
- The dotfiles repo links back: its GitHub homepage is `https://stevanpavlovic.com/work/dotfiles`, and its `AGENTS.md` lists the paths this page reads. Keep the route stable, or change the homepage and those links in the same step.
- The share image `public/og-dotfiles.jpg` comes from `scripts/generate-images.ts`. It reads the facts, so CI needs `GITHUB_TOKEN`. `images.yml` also runs every Monday.
- Every command strip shows a real command and its real output. A list that no command prints uses `title` instead of `command` (no `$` prompt).
- Skill names come from the GitHub tree (`facts.skillNames`, the `claude/skills/ps_*/SKILL.md` paths). A name missing from the catalog gets phase `care` and the new copy, so a new skill never breaks the build.
- No usage data: the owner's own session stats never ship.

## Code rules

- The canvas and labels are `aria-hidden`; each step carries every fact a label shows.
- One pure geometry (`blueprint-geometry.ts`) feeds the WebGL renderer and the build-time SVG posters.
- Client modules import `StepId` from `step-ids.ts`, never `steps.ts`: that pulls zod and the copy into the chunk.
- Renderer: one WebGL2 context, no three.js, DPR at most 1.5. No WebGL2 or a software renderer keeps the poster.
- The loop runs only while the stage is in view, the tab is visible and motion is allowed. Step offsets come from a ResizeObserver, never from `innerHeight` per scroll.
- `stillQuery()`: no loop, one still frame per step. Tilt only on `(hover: hover) and (pointer: fine)`. Drag orbit (`story-orbit.ts`) also works in still mode.
- The stage is a sticky `100svh` sheet (`svh`, so the address bar never resizes the canvas). Labels, plates and the line dim avoid every step text on screen, not only the current one: a tall step comes in while the previous is still current.
- Text shade: none since 2026-10-24 (owner). Do not add a box, a blur or a dark radial behind `.story-body`. The renderer dims lines under the text (`dimTo` 0.2).
- Contrast: worst text at least 4.5:1. Probe: `.audit/story-feel-2026-10-22/contrast-probe.ts`. Do not use the older `.audit/work-cards-2026-10-22/contrast-probe.ts`: it predates the frost.
- Phones (under 48em): at most four labels (`phoneLabelLimit`). The step cue is the CSS scroll-timeline bar `.scroll-progress`; only browsers without `animation-timeline` get `--story-progress` from the mount, set on the `.scroll-progress` element (a custom property on `.story` restyles the whole story every frame). The rail is a sticky `100svh` box; from 48em the next box pulls up under it with a `-100svh` top margin (`.scroll-rail + .story-stage` here, `.sky-steps` on the sky story).
- Shared parts (also used by the sky story): `scroll-progress.astro`, `scroll-rail.astro`, `scroll-rail.ts` (`bindRail`) and `scroll-rail.css`. The rail shows once the mount sets `data-story-state="live"`.
- While live, the HTML strip stays in the step but is visually hidden and loses `tabindex`. `h2` has no plate.
- The `/work` morph names live under `html[data-story-morph]` (`story-morph.ts`), because `title-morph.ts` strips inline names.

## Floor

- A steep floor behind the page, pure CSS on two fixed pseudo layers, no new element. `[data-story]::before` is the grid, `::after` a copy in the wave colors, only the near 40% of the plane, masked by a band whose position is the registered `@property --story-wave-at`, animated by `story-wave` (8 s).
- Anti-moiré rule: no grid line may get denser than about 3 px per cell on screen. Rows are `--story-row` thick because a thin row shrinks under a pixel and breaks into dashes.
- While the page scrolls (`:root[data-scrolling]`, set by `scroll-fade.ts`) the wave is removed and restarts from its faded first frame: its mask repaint is about two thirds of GPU time while scrolling. A paused wave still repaints, so remove it, do not pause it. The sway stays on the compositor.
- Reduced motion and `:root[data-motion-paused]` remove both animations.
- The stage, posters and canvas are transparent (premultiplied blend), so the drawing sits on the floor with no seam.
- Dotted decoration (`blueprint-dots.ts`): the face program draws a depth-only pass, the faint fill with no depth test, then the dots once with `LEQUAL` and no depth writes. Dots fade out between 4 and 7 CSS px of spacing. The build-time SVG uses one `<pattern>` per plane and has no occlusion.

## Text dwell

- CSS only, shared (`.scroll-text`, `@keyframes scroll-dwell` in `scroll-rail.css`). No code ever moves the scroll, except a rail tick or a skip link the visitor clicks. The old scroll magnet was dropped on 2026-10-22: the owner felt the pull as a fault. Native `scroll-snap` was dropped before it. `magnet` in `math.ts` stays for the Weather range `snapStop`.
- Within `--scroll-dwell` (50vh) of its read spot, a `.story-body` gets a `translate` of at most 6.4vh. It never sits below its read spot, and only one text moves at a time. Labels and plates read `getBoundingClientRect`, which includes the offset. Reduced motion and pause: `animation: none`.
- Rail ticks land on the read spot (`block: "end"` unless the text is taller than three quarters of the screen). Steps carry `scroll-margin-block-end` that cancels the page's bottom padding. This page passes `notBeforeTop`, so a jump never stops above the step top (`stepAt` also allows 2px).

## Skills walk

- The `skills` step sits along the work loop (`skill-map.ts`). Half a screen per skill plus one finale screen (`--story-stops` on the `li`, `data-stops` for the mount). `walkOf` ends the walk one screen before the step ends.
- The step carries `contain: layout`: without it Chrome logs a full-screen layout shift (CLS 1.0) when the page goes live.
- Its `.story-body` never dwells. While live it is sticky at the bottom; when taller than the room under the bar (200% text), `measure()` sets `data-story-loose` and it is not pinned.
- A skill missing from the catalog is a dashed outline with "New in the harness." Still mode: one frame per stop (`stillGoal`).

## Performance

- Never write a style or attribute per frame on `.story` or `html`. Pins, plates and the wire write a transform or path only when it changed. Probe: `.audit/scroll-perf-2026-10-22/probe.ts` (headed Chromium; a headless run fakes 60 fps).
- Budget: the page's own JS under 35 KB gzipped. Gate: `pnpm audit:site --only story` at 320, 390, 768, 1024, 1440 and 390 with a 200% root font.
