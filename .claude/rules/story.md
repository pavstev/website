---
paths:
  - "src/pages/work/dotfiles.astro"
  - "src/components/story/**"
  - "src/lib/story/**"
  - "src/lib/story-morph.ts"
  - "src/lib/dotfiles-facts.ts"
  - "src/data/dotfiles-story.ts"
  - "src/styles/story.css"
  - "scripts/audit/check-story.ts"
---

# The dotfiles story (`/work/dotfiles`)

Siblings: `card.md` (the `/work` card), `motion.md`, `sky.md`. One page, not a framework: the next project story is its own thing.

- Copy lives in `src/data/dotfiles-story.ts`. Move `storyMeta.updatedAt` on every copy edit: it is the sitemap `lastmod` and the `WebPage` `dateModified`.
- `copy-rules.ts` checks `line` and `note`: 3 to 7 words a line (the two titles excepted), 2 to 4 sentences and 55 words a note, no em dash, no banned word, no question, no exclamation mark, no city. Every number comes from `facts` or `storyMeta` through a template. The sentinel test fails on a number typed by hand.
- Facts come from GitHub at build (`dotfiles-facts.ts`). A truncated tree or a missing blob fails the build. Forks and stars are 0, so the copy never shows them.
- DOM: `section.story[data-story-root]` holds the rail, `div.story-stage` (posters, `canvas.story-canvas`, `div.story-labels`), `p.story-progress` and `ol.story-steps > li.story-step[data-step]`. The canvas and labels are `aria-hidden`; each step carries every fact a label shows.
- One pure geometry (`blueprint-geometry.ts`) feeds the WebGL renderer and the build-time SVG posters. Counts reach the browser as `data-story-counts`.
- Client modules import `StepId` from `step-ids.ts`, never `steps.ts`: that pulls zod and the copy into the chunk.
- Renderer: one WebGL2 context, two programs, DPR at most 1.5, no three.js. It sizes from the canvas rect. No WebGL2 or a software renderer keeps the poster.
- The loop runs only while the stage is in view, the tab is visible and motion is allowed. It sleeps once settled. Step offsets come from a ResizeObserver, never from `innerHeight` per scroll.
- `stillQuery()` (reduced motion or the Motion switch): no loop, one still frame per step. Tilt only on `(hover: hover) and (pointer: fine)`.
- Phones (under 48em): the stage is 56svh and the steps flow below it, never over it. At most four labels (`phoneLabelLimit`); a leader draws only for a kept label. A strip shows its command and four rows, then scrolls; on desktop it shows every row. Desktop: text bottom left over the stage, 50ch, no box; a label over the step text fades out.
- The share image `public/og-dotfiles.jpg` comes from `scripts/generate-images.ts` (the poster, the word and a "Drawn by" title block with the portrait, name and domain: the brand on every share). It reads the facts, so CI needs `GITHUB_TOKEN`. `images.yml` also runs every Monday, so the counts follow the dotfiles repo.
- Every command strip shows a real command and its real output. A list that no command prints uses `title` instead of `command` (no `$` prompt).
- The `/work` morph names live under `html[data-story-morph]` (`story-morph.ts`), because `title-morph.ts` strips inline names.
- Budget: the page's own JS under 35 KB gzipped. Gate: `pnpm audit:site --only story` at 320, 390, 768, 1024, 1440 and 390 with a 200% root font.
