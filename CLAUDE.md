# CLAUDE.md

One static page: a contact card over a WebGL sky, plus a plain 404.

## Tech Stack

- **Framework:** Next.js 16 App Router, `output: "export"`, prerendered to `dist/`. Routes: `/` (`src/app/page.tsx`), 404 (`src/app/not-found.tsx` → `dist/404.html`, `noindex`), `/sitemap.xml` (with image entries), `/robots.txt`, `/manifest.webmanifest` (`src/app/manifest.ts`), `/llms.txt` (`src/app/llms.txt/route.ts`). All of them are built from `personal.ts`, `i18n.ts` and the build-time repo list; never add a second page.
- **UI:** Tailwind v4 (`@theme inline` + `@utility`, via `@tailwindcss/postcss`). Server components by default; `"use client"` only for the sky (`space-background.tsx`), the clouds (`clouds-canvas.tsx` → `src/lib/clouds.ts`, one three.js full-screen shader, imported after `load`, skipped on Save-Data), cursor glow, the PDF button, the portrait dialog and `effects-init.tsx`.
- **Fonts:** self-hosted woff2 in `public/fonts/` with versioned names (Inter Variable latin, Geist Mono 400/500 latin, plus small `*-extra-*` files for ć č đ š ž, cut with fonttools' `pyftsubset` and woff2 output). `@font-face` sits at the top of `globals.css`. Do not preload them: it pushed LCP from 0.9 s to 1.5 s on slow 4G. To change a font, ship a new file name (the `/fonts/*` cache rule is immutable).
- **Icons:** `<Icon>` (`src/components/icon.tsx`) renders inline SVG from `src/lib/icon-data.ts`. Sets in use: `circle-flags`, `lucide`, `simple-icons`. A new `set:name` needs `pnpm icons` (run `pnpm add -D @iconify-json/<set>` for each set first, then remove them again).
- **Repo strip:** `src/lib/github.ts` fetches public repos at build time. Set the optional `GITHUB_TOKEN` build variable to lift the 60 requests per hour limit. Any non-200 answer fails the build on purpose, so a broken strip never ships.
- **Static files:** `public/resume.pdf` is committed and replaced by hand when the CV changes (the button downloads it as `Stevan_Pavlovic_Resume.pdf`). Portraits (`public/portraits/`), favicons and `og-image.jpg` (1200x630: the sky, the portrait, name, title, Vienna) are committed too. Nothing is generated at build time.
- **Content:** `src/lib/personal.ts` (name, title, summary, links); all UI strings in `src/lib/i18n.ts`.
- **Pkg mgr:** pnpm 12 (`packageManager`), Node 24 (`.nvmrc`), both enforced by `engines` with `engineStrict`. All pnpm settings live in `pnpm-workspace.yaml`: the build-script allowlist (`allowBuilds`, `strictDepBuilds`), a one-day `minimumReleaseAge`, `trustPolicy: no-downgrade` with one exact `trustPolicyExclude` entry (`semver@6.3.1`, a 2023 security backport without provenance; evidence in the commit that added it), `blockExoticSubdeps` and `verifyDepsBeforeRun: install` (scripts install first when the lockfile changed). Keep `package.json` scripts to the eight that exist. Add a trust exception only as an exact `name@version` with checked evidence, never by turning the policy off.
- **Profile mirror:** `src/profile/` builds the README and images for `pavstev/pavstev` from `personal.ts`, `i18n.ts`, `icon-data.ts`, `theme.ts` and the same `getRepos` call as the site. `render.ts` is pure (data in, `{ path, contents }[]` out, deterministic); `cli.ts` is the only file that reads or writes. Output goes to the gitignored `.profile-out/`. `.github/workflows/profile.yml` pushes it to `pavstev/pavstev` with the deploy key secret `PROFILE_DEPLOY_KEY`. The code never reaches the Next.js bundle (nothing in `src/app` imports it). The header is a generated SVG with Inter embedded; keep it under 120 KB.
- **CI:** `.github/workflows/ci.yml` runs `pnpm verify` and `pnpm profile:check` on pushes and pull requests and fails when it would change files. Dependabot opens grouped weekly updates.
- **Deploy:** every push to `main` makes Cloudflare build the repo and publish `dist` as Workers static assets (`wrangler.jsonc`, `404.html` for unknown paths). Nobody deploys by hand: do not run `wrangler deploy` or `pnpm deploy`. Push to `main` only when asked and after `pnpm verify` passes. `public/_headers`: immutable for `/_next/static/*` and `/fonts/*`, one day plus stale-while-revalidate for `/portraits/*`, the favicons, the manifest icons and `og-image.jpg`; HTML and `resume.pdf` revalidate every time. `/*` carries the security headers and a CSP (`'self'` only; scripts and styles need `'unsafe-inline'` for Next's inline payload and style attributes); every non-HTML rule detaches the CSP and `X-Frame-Options` with `! Header-Name`, so they reach pages only. Keep the rules disjoint (Cloudflare joins duplicate headers with a comma).

## Commands

```bash
pnpm dev       # next dev → http://localhost:4321
pnpm build     # next build → ./dist
pnpm preview   # serve ./dist on port 4321
pnpm verify    # prettier + eslint --fix + tsc + build + knip  ← REQUIRED before done (also the pre-commit hook)
pnpm icons     # re-extract src/lib/icon-data.ts
pnpm profile   # build the GitHub profile files into ./.profile-out
pnpm profile:check  # profile tests + build + validation (also run in CI)
```

## Non-negotiables

- **No comments, JSDoc, TODO/FIXME/XXX/HACK** in source.
- **Run `pnpm verify` before declaring done.**
- **No `eslint-disable`**: zero-warning policy.
- **No `any`** → use `unknown` or generics. **No `!`** non-null assertions.
- **No hardcoded hex/hsl** outside `globals.css` or `src/lib/theme.ts`.
- **No inline UI strings** → `src/lib/i18n.ts`.
- **Tailwind v4 paren syntax** (`bg-(--surface)`) over bracket syntax.
- **Never edit generated files** in `dist/`. **Never commit `.env`.** **Never deploy by hand.** **Never edit `pavstev/pavstev` by hand** (the Action overwrites it).

## Code Style

TypeScript strict, explicit return types on exports, `import { type Foo }`, kebab-case files, PascalCase components, one component per file in `src/components/`.

## Layout

```text
src/app/          layout.tsx (metadata, Open Graph `profile`), page.tsx (JSON-LD, sky, clouds, cursor glow, the card), not-found.tsx, robots.ts, sitemap.ts, manifest.ts, llms.txt/route.ts
src/components/   profile + portrait + portrait-expander, download-button, contact-links, repo-strip, card-footer,
                  privacy-note, clouds-canvas, space-background, cursor-glow, effects-init, icon
src/lib/          personal, i18n, theme (hex for theme-color, sky palette, repo language colors), github,
                  clouds, scroll-motion, intro, portrait-effects, portrait-expand, contact-links, download-ring,
                  pill-aurora, cursor, webgl, icon-data
src/styles/       globals.css (tokens, one dark palette + print, type utilities, card styles)
public/           resume.pdf, portraits/, fonts/, favicons, og-image.jpg, manifest.webmanifest, _headers
src/profile/      types, text, icons, header, readme, render (pure), validate, cli, tests
scripts/          generate-icon-data.ts (pnpm icons, run by Node's type stripping)
```

## The card

- Order: portrait (relight, holographic foil on hover, orbit; click opens a dialog with the 800 px image), name, summary (Light 300, faint halo, a round `circle-flags:at` after the city; blur-in, skipped when hydration starts after 1 s so painted text never vanishes), PDF button (gradient hover, light sweep, click ring sequence) with round contact links (metal rings whose highlight faces the cursor, tooltips), repo strip (each tile gets its own planet: `ring`, `bands`, `moon`, `craters` by position, size and tilt from the repo name), `© year name`.
- Name: a pure-CSS 5.6 s "signal tuning" intro (blur, scan lines, rose and teal slices, neon flicker) starts at first paint and stays readable after about 1 s. `src/lib/name-glitch.ts` then sets `data-glitch` for a 0.72 s burst (scan sweep, shredded slices, two neon blinks) every 8 s, rests after 30 s without input and resumes on input. It sets `data-tuned` first so the intro never replays. The copies are pseudo-elements with `content: attr(data-text) / ""`, so screen readers read the name once. Keep every flicker under three flashes per second.
- On screens at least 768 px wide and 720 px tall the page does not scroll: `html` is `overflow: hidden` and `max-height` queries compact the card. Narrow screens scroll normally.
- Privacy note (`privacy-note.tsx`, a server component with no JS): a round glass chip, "No cookies, no tracking", at the bottom center, never opened by itself and never dismissed for good (no storage). It is a `<button popovertarget>`; the panel is `popover="auto"` (light dismiss, Escape, focus back to the chip) with three lines from `en.privacy`. The panel sits above the chip with anchor positioning (`position-area: top`, fixed fallback) and scrolls when space is short. On the no-scroll layout the chip is `fixed` and `#main-content` reserves `--privacy-zone`; elsewhere it is `sticky` after `main`, so a wrapped chip (zoom, large text) never covers the last line. `html` has `scroll-padding-bottom` so focus is never hidden (SC 2.4.11). The fade-in sits on `.privacy-chip-face`, not on a parent: an animated parent becomes a backdrop root and the blur stops working. The note must stay true: no cookies, storage, analytics or third-party requests. If any arrive, build a real consent flow first (reject as easy as accept on the first layer).
- Sky (`data-space-state`: `running`, `paused`, `static`, `fallback`) caps at about 90 fps, with sparkle spikes on bright stars and a shooting star every 15 to 30 s while the loop runs. Clouds (`data-clouds-state`: `running`, `paused`, `static`, `frozen`, `fallback`) sit on top with `mix-blend-mode: screen`: two drifting domain-warped fBm decks lit from below by a three-step light march, with silver edges, slow billowing cover and a fast thin cirrus layer on top; they part around the cursor on fine pointers; rendered at 0.4x and upscaled, dimmed behind the card (`[data-card]` rect, deeper on wide screens); cap at about 60 fps. Both drop to 30 fps after 800 ms without input, pause when hidden or blurred, degrade on slow frames (resolution, then light steps, then one frozen frame) and draw one still frame under reduced motion. Eight frames in a row over 100 ms freeze either loop, idle or not. On a software renderer (`src/lib/webgl.ts`: SwiftShader, llvmpipe, Microsoft Basic Render) the sky draws one still frame and the clouds never create a context. `sky:pulse` (PDF click, portrait open) sends a soft gust through the clouds.
- `prefers-reduced-motion`: the intro exits early; sky, clouds, scroll motion, portrait effects and cursor scripts also follow the setting when it changes at runtime; CSS animations collapse to `0.01ms`. Pointer-following effects (glow, relight, sky and cloud parallax) run only for `(hover: hover) and (pointer: fine)`.

## SEO

- `src/lib/structured-data.ts` builds one JSON-LD `@graph` (typed with `schema-dts`): `WebSite`, `ProfilePage`, `Person` (name without diacritics and the GitHub handle as `alternateName`, Vienna, `knowsAbout`, languages, `sameAs`, résumé as `subjectOf`) and one `SoftwareSourceCode` per repo in the strip. Mark up only facts the page, the résumé or the linked profiles show. Never add `worksFor`.
- GitHub and LinkedIn links carry `rel="me"`. The meta description names Vienna; the title does not, by the user's choice.
- IndexNow: `public/ee32ef309c036fb4c6b716d08e9bf922.txt` holds the key (public by design, with a header rule that detaches the CSP). After a content change, tell Bing and other engines with `curl -X POST https://api.indexnow.org/IndexNow -H 'Content-Type: application/json' -d '{"host":"stevanpavlovic.com","key":"ee32ef309c036fb4c6b716d08e9bf922","keyLocation":"https://stevanpavlovic.com/ee32ef309c036fb4c6b716d08e9bf922.txt","urlList":["https://stevanpavlovic.com/"]}'`. Google does not use IndexNow; it needs Search Console.
- Cloudflare lets AI crawlers in, training crawlers (`GPTBot`, `ClaudeBot`, `CCBot`) included: Security, Settings, "Configure AI bot policies" has Training on Allow, and AI Crawl Control blocks only `Bytespider`. So Cloudflare prepends no `Disallow` rules to `robots.txt`. That is a dashboard setting, not code.

## Accessibility

WCAG 2.1 AA. Focus rings via `.focus-ring`. Axe finds 0 violations at three sizes; contrast over the sky is measured by hand. Don't lower `--primary` / `--muted-foreground` contrast (8.0:1 and 6.4:1 on `--background`). Icon-only links carry `aria-label`; tooltips are `role="tooltip"` and dismiss on Escape.

## Skills

- Visual work: `frontend-design`. three.js clouds: `threejs-skill-router` (`threejs-volumetric-clouds`, `threejs-procedural-fields`), check with `threejs-visual-validation`.
- Performance: `cloudflare:web-perf`. SEO and metadata: `seo`. Accessibility: `design:accessibility-review`.
- Hosting config: `cloudflare:wrangler`. Runtime check: `next-dev-loop` against `pnpm dev`; screenshots: `playwright-cli`.
- Measure with Lighthouse, axe-core and Playwright from outside the repo; keep test scripts, reports and screenshots tooling out of it (only the README hero image lives in `.github/assets/`). Commits: `ps-commit-message`. Before done: `superpowers:verification-before-completion`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
