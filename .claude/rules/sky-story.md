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
- The look is not the dotfiles look: no grid floor, no frosted box, no plates, no command strips, no rail of ticks. Text sits on the sky with the `text-sky` ink and glow, like the home. An `aria-hidden` 24 hour ring dial (top right, `sky-dial.astro`) turns a sun or moon dot on a CSS scroll timeline: 06:00 left, 12:00 top, 18:00 right. Its keyframes are built at build time from each slide's clock and `screens`. The hero shows an `aria-hidden` scroll cue (a falling line) that fades over the first scroll. The outro has one round main button (Open the live sky) and two quiet links.
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
- Tables: `safeSkyTable` costs 2 to 3 ms (about 10 ms on a slow phone), too slow per frame. `sky-story-grid.ts` builds 97 tables on idle (12 per chapter, nearest first) and `mixSkyTable` blends the two nearest; after 180 ms at rest the exact table is built on idle. When the grid has no table near the chapter (a cold first visit, a jump), the exact table is queued on idle at once and the next ink read is firm. The grid resets on a width change or a height change over 15%.
- Ink: `storyInkTargets` (eyebrow 4.5, line 3, note 4.5 per step, group `step-<i>`) plus `postInkTargets`. The page renders `BlogHeader` with `header={false}` (the bar and crumbs, no header h1), so the header targets find nothing and are skipped; a 0 x 0 box is skipped too. `BarSpy` reads the hero h1 (`[data-sky-story] h1`) for the bar glass. The probe runs every 250 ms while scrolling and firm at rest.
- Glide: the sky shot runs only between blog pages and the story. Home and story swap at once.
- Still modes without the loop (software renderer, Save-Data, crawler) redraw only when the rounded chapter changes (`stillStep`) and build no table grid; the exact table is queued on idle at once after each change.
- Contrast: `pnpm audit:site --only contrast` measures every step at phone and laptop (`step-<id>` spots). Titles and notes pass. The eyebrow is `--fs-md` (14 px), weight 500, with a floor glow (`--eyebrow-glow`); it passes at every step (worst 4.80, 2026-10-24). The note shares that tight floor glow, because a lit night cloud can drift behind the outro note on a phone (it read 4.36 with the wide glow).
- View: story mode tilts the camera. `storyHorizon(c)` (`sky-story.ts`) eases the horizon from 2% (home) to 11% of the height over chapters 0 to 0.75, then holds. `ViewSize.horizon` carries it (`sky-view.ts`, default 2%, so home and blog are unchanged); the zenith stays on the top edge. `sceneView()`, the table grid (`storyView(gridView, at)`) and `sunSpot` all take the tilted view. The sunrise sun and the night moon stay clear of the notes at 390x844 and 1280x800.
- Weather: the rain front runs c 3 (partly), 3.4 (overcast), 3.75 to 4.35 (rain), 4.75 (partly), 5 (clear). The weather step is 3 screens.

## No WebGL

- `:root:has([data-space-state="fallback"])` shows a build-time gradient per step (`sky-story-poster.ts`, from `paintScene` at `storyInstant(i)`), and bright steps switch to dark ink.

## `/work` Stories section

- `storyEntries` in `work.ts` lists both stories (website first). `StoryStrip` renders one glass row per story with a round `StoryMark` (the sky mark turns a day wheel to night on hover; the blueprint mark lifts its slabs). The repo cards keep "See the story".
- Only the dotfiles card morphs into its story (`[data-story-path="/work/dotfiles"]`), so view-transition names stay unique.
