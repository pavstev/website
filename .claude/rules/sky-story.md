---
paths:
  - "src/pages/work/website.astro"
  - "src/components/sky-story/**"
  - "src/data/website-story.ts"
  - "src/data/website-story.test.ts"
  - "src/lib/sky-story.ts"
  - "src/lib/sky-story.test.ts"
  - "src/lib/sky-story-store.ts"
  - "src/lib/sky-story-grid.ts"
  - "src/lib/sky-story-grid.test.ts"
  - "src/lib/sky-story-scroll.ts"
  - "src/lib/sky-story-scroll.test.ts"
  - "src/lib/sky-story-poster.ts"
  - "src/lib/sky-story-poster.test.ts"
  - "src/styles/sky-story.css"
  - "src/styles/scroll-rail.css"
  - "src/components/scroll-*.astro"
  - "src/lib/scroll-*.ts"
  - "src/components/story-mark.tsx"
---

# The sky story (`/work/website`)

Siblings: `sky.md` (the engine), `story.md` (the dotfiles story, a different look), `card.md` (the `/work` page).

## What it is

- Scrolling plays one real day (2026-10-24) at the default place: blue hour, sunrise, morning, solar noon (12:38), a rain front, sunset, the moon at its highest (23:33, due south), late night, then the outro. Chapter names must match the real sky at their clock (owner, 2026-10-24): no "Midday" or "Night" label on a time that is not that.
- The drawing is the real painted home sky (`sky-mount.ts` in `story` mode), not a copy. Only the clock and a scripted weather path come from the scroll.
- The look is not the dotfiles look: no grid floor, no frosted box (no `backdrop-filter`, no blur on or behind text), no plates, no command strips. Text sits on the sky with the `text-sky` ink, like the home.
- It shares the dotfiles scroll parts (`story.md`): the progress bar under the bar on phones and the right rail of ticks from 48em. Rail names come from `en.skyStory.railTick`. The rail takes the step's ink: a `MutationObserver` on each `.sky-step-line` `data-ink` copies it to the rail (written only on change).
- The `aria-hidden` 24 hour ring dial (`sky-dial.astro`) turns a sun or moon dot on a CSS scroll timeline: 06:00 left, 12:00 top, 18:00 right. It sits behind the text (`z-index: 0`), so a tall text at 200% zoom stays on top. It is sized in px (`--sky-dial`), so a larger root font does not grow it. It hides under 24em. Under 48em there is no rail and the dial sits at the right edge; from 48em it moves left of the rail column. The only breakpoint is 48em.
- Fluid sizes: no size jumps between 320 and 1920, except the small rail room step at 48em. Keyframes are built at build time from each slide's clock and `screens`.
- Numbers are fine in this copy (the "names, not counts" rule is for the dotfiles page only). No city in any text or meta. Copy rules: `lintCopy(step, { numbers: true })` in `website-story.test.ts`.

## Data and contract

- Copy: `src/data/website-story.ts` (`skyStorySlides`, `skyStoryMeta.updatedAt`). Move `updatedAt` on every copy edit: it is the sitemap `lastmod` and the `WebPage` `dateModified`.
- The eyebrow is the clock of `storyInstant(i)` in `Europe/Vienna`; the outro shows "Now" only. The outro li is `#sky-story-end` (skip link target).
- The chapter `c` is a float from 0 to 8; step `i` sits at its read spot when `c === i`. `sky-story-scroll.ts` writes `c` with `setStoryChapter` from a passive scroll listener and one rAF. It writes no style or attribute per frame. Under `stillQuery()` `c` snaps to the nearest step.
- `storyInstant(c)` and `storyWeather(c)` use smootherstep between keys and Hermite dusk waypoints, so the view pans from the sun to the moon without a jump.

## Engine (story mode)

- `routeMode` and `linkMode` return `story` for `websiteStory`, before the `[data-blog]` marker. Place is always `viennaPlace`. No live weather, no place bubble, no sentinel hold.
- Tables: `safeSkyTable` costs 2 to 3 ms (about 10 ms on a slow phone), too slow per frame. `sky-story-grid.ts` builds 97 tables on idle and `mixSkyTable` blends the two nearest; after 180 ms at rest the exact table is built. When the grid has no table near the chapter, the exact table is queued on idle at once. The grid resets on a width change or a height change over 15%.
- Ink: `storyInkTargets` (eyebrow 4.5, line 3, note 4.5 per step, group `step-<i>`) plus `postInkTargets`. The page passes `header={false}`, so the header targets find nothing and are skipped; a 0 x 0 box is skipped too. `BarSpy` reads the hero h1 for the bar glass.
- The sky shot runs only between blog pages and the story. Home and story swap at once.
- Still modes without the loop (software renderer, Save-Data, crawler) redraw only when the rounded chapter changes (`stillStep`) and build no table grid.
- Contrast: `pnpm audit:site --only contrast` measures every step (`step-<id>` spots) at phone and laptop. When the line takes dark ink, the eyebrow follows it (`:has`) with the light glow tone.
- View: `storyHorizon(c)` eases the horizon from 2% to 11% over chapters 0 to 0.75, then holds. `ViewSize.horizon` carries it (default 2%, so home and blog are unchanged). The sunrise sun and the night moon stay clear of the notes at 390x844 and 1280x800.
- Weather: the rain front runs c 3 (partly), 3.4 (overcast), 3.75 to 4.35 (rain), 4.75 (partly), 5 (clear).

## No WebGL

- `:root:has([data-space-state="fallback"])` shows a build-time gradient per step (`sky-story-poster.ts`), and bright steps switch to dark ink.

## `/work` story links

- `/work` has no Stories section. The stories are reached from the "See the story" button on the repo cards (see `card.md`).
- Only the dotfiles card morphs into its story (`[data-story-path="/work/dotfiles"]`), so view-transition names stay unique.
