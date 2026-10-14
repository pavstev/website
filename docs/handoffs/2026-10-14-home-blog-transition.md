# Task

Build a "wow" page transition from the home page to the blog (and back): the sky stays one live canvas, the light source glides to the top-left corner and becomes the blog's ray corona, the far (bottom-right) sky stays as it is.

## Where

- Repo: GitHub pavstev/website (public). Astro 7 static site on Cloudflare. This brief: docs/handoffs/2026-10-14-home-blog-transition.md.
- Branch: start from origin/main (b814bdf or newer, pushed). Work on a new branch `feat/home-blog-transition`.
- Run commands from the repo root. A cloud session starts with no checkout: clone the repo, then `pnpm install --frozen-lockfile`.

## Read first

- CLAUDE.md: hard rules, commands, layout map
- .claude/rules/sky.md: sky modes, shader knobs, ink probe
- .claude/rules/blog.md: blog sky, ClientRouter, morph rules
- .claude/rules/motion.md: pause, reduced motion, head script
- src/components/space-background.tsx: the one sky component (1,170 lines)
- src/lib/sky-rays.ts: blog shader = home shader with two constants swapped
- src/layouts/BlogLayout.astro and Base.astro: only Blog has ClientRouter
- docs/architecture.md: bullets "Sky modes" and "Transitions"

## Facts (verified 2026-10-14)

- `git log -3`: b814bdf fix(blog) text lift, 7a7652e feat(blog) ClientRouter, 2b9d91b docs. `pnpm check` exit 0 at b814bdf. The Cloudflare build of b814bdf succeeded and is live (checked: the live /blog page serves the new router script).
- Blog pages use `ClientRouter fallback="swap"`. The sky island and the dock carry `transition:persist` (`blog-sky`, `blog-dock`). Home (`src/pages/index.astro`, layout Base.astro) has NO ClientRouter: Blog button, brand link and feeds are full loads (`data-astro-reload` on brand, feed, résumé links).
- `src/lib/router-flags.ts` copies `<html>` `data-*` flags on every swap (head script runs only on full load). Base.astro must call `keepPageFlags()` once it gets ClientRouter. `src/lib/blog/title-morph.ts` names card/post titles for the list-to-post morph.
- Home sky = `<canvas data-space>` (fixed, full screen). Blog sky = `div[data-blog-sky]` (fixed, 100lvh + 40vh) holding the canvas, `div[data-sky-fade]` and `div[data-sky-sentinel]`. Mode is a React prop read once in a `useEffect([mode])` that picks the shader.
- `longRaysShader` = home shader with `coronaSize` 0.48 to 1.35 and `coronaBright` 1.06 to 1.05 (`src/lib/sky-rays.ts`, `patchShader`). Corner source: `cornerCorona(view)`, uniform `u_portrait` set by `trackCorner` in blog mode. Blog look: `blogLook()` in `src/lib/sky-preset.ts` (clear night). Home look: real sun, moon, BSC5 stars, planets, clouds from the real clock (`sky-light.ts`, `?at=<ISO>` pins time).
- Persisted islands keep their old props (no `transition:persist-props`), so a mode change cannot be a prop. `astro-island` is `display: contents`: a `view-transition-name` on it makes no box. Named view-transition groups paint ABOVE the root snapshot, so never name the full-screen sky if text must stay on top.
- Home-only machinery to tear down or re-init: `EffectsInit` (intro, cursor, name tear, portrait bead), `[data-card]`, drawers (`<dialog>`), topic popovers, the Vienna globe (second WebGL context, `planet-stage.ts`), `scene-hold.ts`.
- Measured (owner's Mac, 4x CPU, slow 4G): home FCP 330 ms, first sky draw 1.56 s; ClientRouter on blog added no first-draw cost; opening a post by client nav 564 ms vs 402 ms by full load (full load counts first bytes).
- Browser test on b814bdf: 27 of 27 pass in Chrome and WebKit (`~/powertools/scripts/website-blog-nav-e2e.mjs`, owner's Mac only).
- Pitfalls: headless Chrome counts as a crawler and gets the night sky (set a normal desktop userAgent). Software WebGL (SwiftShader, cloud) takes the still path (`isSoftwareRenderer`), so the animation cannot be seen there. The build needs `GITHUB_TOKEN` (non-200 from GitHub fails it on purpose; a 500 is a flake, retry). `CV_SNAPSHOT=1` skips the CV fetch. Owner has no iPhone: test WebKit with Playwright, never suggest a real-iPhone check.
- `scripts/meta-guard.ts` runs in `pnpm build` and fails it if the 404 is not noindex or the home og:url or share titles drift. Keep it green when you edit `src/layouts/Base.astro`.
- Open: everything in Goal. Nothing of the transition exists yet.

## Goal

Clicking "Blog" on the card plays one continuous shot, about 1.2 to 1.8 s: the card fades away, the sun (the moon at night) glides along an arc to the top-left off-canvas corner while its rays stretch into the blog corona, the look blends to the blog's clear night, the blog header and sidebar fade in. The far sky does not jump. The brand link plays it in reverse. The blog is the source of truth: the end frame must match a direct load of /blog. The home sky and card may change where needed. First paint of home must not regress.

## Rules (hard)

- Work on branch `feat/home-blog-transition`. Open a PR. Do NOT push to main and do NOT deploy: every push to main deploys; Cloudflare preview URLs are off. The owner reviews locally. Put frame strips (PNG at progress 0, .25, .5, .75, 1) in the PR.
- Never run `wrangler deploy` or `pnpm deploy`. Never touch the Cloudflare account "Alpha.therapybg".
- `pnpm check` must pass before any commit. No comments or JSDoc, no `any`, no `!`, no `eslint-disable`, no hex outside globals.css and theme.ts, UI strings only in `src/lib/i18n.ts`, Tailwind v4 paren syntax, kebab-case files, no em dashes, short plain sentences.
- The UI must stay the same everywhere except what this feature needs. No new dependency without asking.
- Pause and reduced motion: transition collapses to an instant swap (`stillQuery`, `isSceneHeld()`, `:root[data-motion-paused]` twin for every reduced-motion rule). Also skip it for crawlers, Save-Data, software renderer, no WebGL.
- Keep a11y: 0 axe violations, focus rings, Escape closes, route announcer works.
- Ask the owner design questions through AskUserQuestion in ONE round first (2 to 4 options each, recommendation first). Owner taste: no slop, no taglines, circles, real WebGL, resource-saving. Update `.claude/rules/*.md` and `docs/architecture.md` in the same PR. Other sessions rewrite main: `git fetch` before each commit.

## Phases

1. Recon and design round (read files, list what home vs blog differ in sky, ask the owner: duration, card exit, night moon, reverse, daytime blue to night blend, fallback) | model: opus | effort: max | 40 min
2. Plan the mechanism (lead to verify, not a decision: one persistent canvas and one program, `coronaSize`, `coronaBright`, `u_portrait`, view and look become tweened uniforms driven by an event or shared module state, not a prop; ClientRouter plus `transition:persist` on both layouts; one wrapper markup for both modes) | model: opus | effort: max | 40 min
3. Build: sky tween, Base.astro ClientRouter, home teardown and re-init, card exit, reverse, fallbacks, docs, tests for pure parts | model: opus | effort: high | 150 min
4. Verify: `pnpm check`, Playwright frames in Chromium and WebKit (software GL shows stills only: add a deterministic progress hook for tests if needed), ask the owner to run the Mac tools: `~/powertools/scripts/first-paint-ab.mjs`, `website-blog-nav-e2e.mjs`, `website-nav-speed.mjs`, `website-audit/audit.mjs --fast` | model: sonnet (subagent `ui-verifier`) | effort: high | 40 min
5. Final whole-branch review, then PR | model: opus | effort: max | 30 min

## Done when

- `pnpm check`: exit 0.
- Frames at progress 0 to 1 show the light source reaching the top-left and the last frame matches a direct load of /blog (pixel diff under 1 percent outside the moving stars).
- Home FCP and first sky draw within 10 percent of 330 ms and 1.56 s (owner's Mac probe), or the PR says by how much and why.
- Reduced motion and pause: instant swap, no errors in the console, sky state unchanged.
- PR open with frames, measurements, open questions. Nothing pushed to main.

## Report

Hand back at most 3,000 chars: PR link, files changed, `pnpm check` tail, measurements, open questions.
Write anything longer to `.agents/handoffs/2026-10-14-home-blog-transition.report.md` (gitignored) and cite its path.
