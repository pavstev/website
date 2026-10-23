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
  - "src/components/story-strip.tsx"
  - "src/components/story-mark.tsx"
---

# The sky story (`/work/website`)

Siblings: `sky.md` (the engine), `story.md` (the dotfiles story, a different page with a different look), `card.md` (the `/work` page).

## What it is

- A scroll story of the `website` repo: how this site paints a real sky. Scrolling plays one real day (2026-10-24) at the default place: blue hour, sunrise, morning, midday, a rain front, sunset, the moon at night, late night, then the outro.
- The drawing is the real painted home sky (`sky-mount.ts` in `story` mode), not a copy. Sun and moon are the real ones for the painted instant. Only the clock and a scripted weather path come from the scroll.
- The look is not the dotfiles look: no grid floor, no frosted box, no plates, no command strips, no rail of ticks. Text sits on the sky with the `text-sky` ink and glow, like the home. A thin `aria-hidden` day dial (top right) carries a sun or moon dot on a CSS scroll timeline.
- Numbers are fine in this copy (the "names, not counts" rule is for the dotfiles page only). No city in any text or meta. Copy rules: `lintCopy(step, { numbers: true })` in `website-story.test.ts`.

## Data and contract

- Copy: `src/data/website-story.ts` (`skyStorySlides`, `skyStoryMeta.updatedAt`). Move `updatedAt` on every copy edit: it is the sitemap `lastmod` and the `WebPage` `dateModified`.
- Steps: `skyStorySteps` in `sky-story.ts` (hero, sunrise, morning, midday, weather, sunset, night, yours, outro). The eyebrow is the clock of `storyInstant(i)` in `Europe/Vienna`; the outro shows "Now" only.
- DOM: `section.sky-story[data-sky-story] > ol.sky-steps > li.sky-step[data-step]`, each with `.sky-step-eyebrow`, `.sky-step-line` (h1 on the hero, h2 after) and `.sky-step-note`, all `text-sky`. The outro li is `#sky-story-end` (skip link target).
- The chapter `c` is a float from 0 to 8; step `i` sits at its read spot when `c === i`. `sky-story-scroll.ts` measures read spots with a ResizeObserver and writes `c` with `setStoryChapter` (`sky-story-store.ts`) from a passive scroll listener and one rAF. It writes no style or attribute per frame. Under `stillQuery()` `c` snaps to the nearest step.
- `storyInstant(c)` and `storyWeather(c)` map the chapter to the instant and the weather (smootherstep between keys, Hermite dusk waypoints so the view pans from the sun to the moon without a jump).

## Engine (story mode)

- `routeMode` and `linkMode` return `story` for `websiteStory`, before the `[data-blog]` marker. `paintsSky(mode)` is true for home and story.
- Place is always `viennaPlace`. No live weather, no place bubble, no sentinel hold.
- `storyEvent` marks the scene stale; the loop applies it once per frame and only when the chapter changed. Still modes draw one still frame per change. Clouds keep their 33 ms cadence.
- Tables: `safeSkyTable` costs 2 to 3 ms (about 10 ms on a slow phone), too slow per frame. `sky-story-grid.ts` builds 97 tables on idle (12 per chapter, nearest first) and `mixSkyTable` blends the two nearest; after 180 ms at rest the exact table is built on idle. The grid resets on a width change or a height change over 15%.
- Ink: `storyInkTargets` (eyebrow 4.5, line 3, note 4.5 per step, group `step-<i>`) plus `postInkTargets`. The page renders `BlogHeader` with `header={false}` (the bar and crumbs, no header h1), so the header targets find nothing and are skipped; a 0 x 0 box is skipped too. `BarSpy` reads the hero h1 (`[data-sky-story] h1`) for the bar glass. The probe runs every 250 ms while scrolling and firm at rest.
- Glide: the sky shot runs only between blog pages and the story. Home and story swap at once.
- Still modes without the loop (software renderer, Save-Data, crawler) redraw only when the rounded chapter changes (`stillStep`) and build no table grid; the exact table comes after 180 ms at rest.
- Contrast: `pnpm audit:site --only contrast` measures every step at phone and laptop (`step-<id>` spots). Titles and notes pass. The eyebrow carries a floor glow (`--eyebrow-glow`). Known miss (2026-10-24): the eyebrow reads 4.0 to 4.2 (need 4.5) at a few steps (sunset laptop, night and outro on a phone) where a lit cloud rim or the dusk band drifts behind it.
- Known miss: on a 390 wide phone the night moon can sit behind the right end of the note.

## No WebGL

- `:root:has([data-space-state="fallback"])` shows a build-time gradient per step (`sky-story-poster.ts`, from `paintScene` at `storyInstant(i)`), and bright steps switch to dark ink.

## `/work` Stories section

- `storyEntries` in `work.ts` lists both stories (website first). `StoryStrip` renders one glass row per story with a round `StoryMark` (the sky mark turns a day wheel to night on hover; the blueprint mark lifts its slabs). The repo cards keep "See the story".
- Only the dotfiles card morphs into its story (`[data-story-path="/work/dotfiles"]`), so view-transition names stay unique.
