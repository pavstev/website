# CLAUDE.md

A contact card over a WebGL sky seen from 100 km up, a blog of MDX posts (`/blog`) under the same sky, a plain 404, and a Worker for `/mcp`.

## Tech Stack

Next.js 16 App Router (`output: "export"` to `dist/`), Tailwind v4, pnpm 12 on Node 24, one Cloudflare Worker for `/mcp`. The long notes (CV feed, GitHub data, fonts, icons, static files, products, profile mirror, LinkedIn sync, Worker, blog, previews, IndexNow, checks, CI, deploy) are in `docs/architecture.md`: read the bullet for the area you change.

Path rules in `.claude/rules/` load when you touch matching files: `card.md` (card, section buttons, drawers, topics), `motion.md` (pause button, dock, privacy, head script), `globe.md` (Vienna globe), `sky.md` (sky, planets, shaders), `blog.md` (posts, blog code, how to add a post).

## Known blockers

- `GITHUB_TOKEN` is **required** for the build (profile email, LinkedIn, repo languages). Cloudflare build variable; locally `github.ts` asks `gh auth token`. Any non-200 answer fails the build on purpose.
- The CV fixture `src/lib/cv-feed.fixture.json` is a byte copy of hirista's `fixtures/cv-feed.json`. Change a feed shape in both repos in the same session. `.prettierignore` keeps it byte-exact.
- The owner has no iPhone. Never suggest a real-iPhone check; emulate WebKit instead.
- Every push to `main` deploys on Cloudflare. Never run `wrangler deploy` or `pnpm deploy`. Push only when asked and after `pnpm check` passes. Say which deployment carries a commit before calling it live. Two deploy hooks also build `main`: hirista on a résumé save, and `blog-publish.yml`, which runs every 15 minutes and calls the hook (secret `CLOUDFLARE_DEPLOY_HOOK`) when a scheduled blog post is due. Schedule a post by giving it a future `date`; see `.claude/rules/blog.md`.
- Never touch the Cloudflare account "Alpha.therapybg" (the owner's other account, under the owner's address): no dashboard, no wrangler, no API, no MCP. Ask which account to use.

## Commands

```bash
pnpm dev       # CV fetch, blog prebuild, then next dev → http://localhost:4321 (drafts show)
pnpm dev:many  # the same plus 30 generated test posts (BLOG_FIXTURES=1), for pagination and tags
pnpm build     # CV fetch, blog prebuild, next build, CV guard → ./dist
pnpm preview   # serve ./dist on port 4321
pnpm check     # every check, read-only  ← REQUIRED before done (also the husky pre-commit hook and CI)
pnpm fix       # prettier --write + eslint --fix
pnpm icons     # re-extract src/lib/icon-data.ts
pnpm stars:build <catalog.gz>  # repack src/lib/star-data.ts from the BSC5 catalog (CDS VizieR V/50)
pnpm profile:build  # build the GitHub profile files into ./.profile-out
```

## Non-negotiables

- **No comments, JSDoc, TODO/FIXME/XXX/HACK** in source.
- **Run `pnpm check` before declaring done.**
- **No `eslint-disable`**: zero-warning policy.
- **No `any`** → use `unknown` or generics. **No `!`** non-null assertions.
- **No hardcoded hex/hsl** outside `globals.css` or `src/lib/theme.ts`.
- **No inline UI strings** → `src/lib/i18n.ts` (one exception: diagram copy lives in `src/lib/blog/diagrams.ts`, post content that the Node-side Markdown converter loads).
- **Tailwind v4 paren syntax** (`bg-(--surface)`) over bracket syntax.
- **Never edit generated files** in `dist/`. **Never commit `.env`.** **Never deploy by hand.** **Never edit `pavstev/pavstev` by hand** (the Action overwrites it).

## Code Style

TypeScript strict, explicit return types on exports, `import { type Foo }`, kebab-case files, PascalCase components, one component per file in `src/components/`.

## Layout

```text
src/app/          layout.tsx (metadata, Open Graph `profile`), page.tsx (JSON-LD, sky, the card), not-found.tsx, robots.ts, sitemap.xml/route.ts, manifest.ts, llms.txt/route.ts, cv.json/route.ts, resume.pdf/route.ts
src/app/blog/     layout.tsx, page.tsx (the index), [slug]/page.tsx (a post), [slug]/[...rest]/page.tsx (/blog/page/<n>, /blog/tag/<slug>, /blog/tag/<slug>/page/<n>), feed.xml/route.ts, feed.json/route.ts
src/components/   profile + portrait + portrait-expander, compound-text, download-button, resume-tip, contact-links, card-sections (the projects, products and blog buttons), card-drawer (the projects and products drawers), repo-strip, product-strip, product-mark, site-footer (the card and the blog footer),
                  page-dock, motion-toggle, privacy-note, space-background, effects-init, icon,
                  topic-trigger, topic-panel, topic-heading, industry-panel, city-panel, city-heading, city-globe-launcher, city-globe-stage, vienna-arms
src/components/blog/  blog-header (the sticky bar and the header for the index and posts), author-photo, blog-side (the branding sidebar), bar-spy, blog-index (the shared index view), post-list, post-date (date, relative text, tip), pagination, tag-row, post-header, post-body, post-toc, toc-spy, toc-drawer, post-nav, post-tags, blog-link, blog-image, blur-image, figure, image-zoom, note, chart (+ chart-rows, chart-line, chart-table), diagram (+ diagrams/)
src/lib/          personal, sitemap (the sitemap.xml writer), products, product-marks, i18n, bio, industries, github (repos, languages, contact, getProject), cv (the CV feed, getCv), cv-feed.fixture.json (hirista's contract fixture), cv-llms, cv-sample (test data), linkedin-fields, resume-pdf, resume-file, readme-html, resume-facts, anchored-popovers, repo-tags-fit, privacy-ack, motion-pause (pause flag, head script, stillQuery), scene-hold, save-data, uniform-sink (cached uniform setter), sky-light (sun, moon and light from the real clock, `?at=`, the air mass to the limb), sky-ephemeris (sun and moon positions and phase), sky-view (the 100 km eye, the limb, the stereographic view and where it faces), sky-scene (world puffs on the cloud deck, pointer look), sky-frame (equatorial and galactic matrices), sky-stars (star colors, star list decode), star-data (BSC5 stars, generated by `pnpm stars:build`), sky-planets (the five naked-eye planets), star-gl (the star points program, Earth occlusion and extinction), city, city-globe, globe-data, globe-labels, sun, world-cities, repo-planets, planet-gl, planet-stage (the shared WebGL context, size, clear state and frame loop), logo-planet, logo-motion, theme (hex for theme-color, sky palette, productPalette, inkPalette), sky-clock, sky-preset (sky modes, the blog look and the Earth's cloud look), sky-rays (the LinkedIn cover rays and shooting star path, shared by the post header and the image generator), sky-ink (text over the sky: targets, lift), sky-probe (reads the sky behind text), crawler (bot user agents get the night sky), github,
                  frame-clock, intro, portrait-effects, portrait-bead, portrait-expand, contact-links, download-ring,
                  pill-aurora, cursor, webgl, icon-data
src/lib/blog/     schema, posts, schedule (go-live instant, scheduled posts), dates (Vienna date, relative date, tip lines), reading (reading time), tags, pagination, listing and listing-route (index, tag and page listings), fixture-posts (30 dev-only test posts), build-env (drafts, fixtures, robots), format (reading time label, post title), links (external link test), render (`evaluate()`), plain (Markdown and feed HTML), toc, anchors, media (hashed names, manifest), share (share images), metadata, feeds, chart-data, chart-layout, diagrams (diagram copy lives here, not in i18n), diagram-ink, tests
src/styles/       globals.css (tokens, one dark palette + print, type utilities, card styles, blog styles)
content/blog/     <slug>/index.mdx, data/*.json for charts, stills and cover.webp per post
public/           stevan-pavlovic.jpeg, portraits/, fonts/, favicons, og-image.jpg and linkedin-cover.png (both generated in CI), manifest.webmanifest, _headers; generated and gitignored: blog-media/, blog/ (Markdown copies), build.json
src/profile/      types, text, icons, header (+ header-sky.webp, made by generate-images in CI), readme, render (pure), validate, cli, tests
worker/           index (router), mcp (/mcp), facts (cv.json + llms.txt reader and text helpers), http, tests, tsconfig.json
wrangler.jsonc    assets, run_worker_first, MCP_LIMITER, `preview_urls: false`; worker-configuration.d.ts is generated from it
scripts/          cv-fetch.ts, blog-build.ts, preload-guard.ts and cv-guard.ts (run by `pnpm build`; blog-build also runs in `pnpm dev`), indexnow.ts (indexnow.yml), generate-icon-data.ts (pnpm icons), generate-globe-data.ts, generate-star-data.ts (pnpm stars:build), generate-images.ts (images.yml), blog-publish.ts (blog-publish.yml, every 15 minutes: builds the site when a scheduled post is due), linkedin-sync.ts (linkedin-sync.yml), all run by Node's type stripping
.cv/              gitignored: cv.json and source, written by cv-fetch
.blog/            gitignored: media.json (hashed image manifest), written by blog-build
.github/workflows/  ci, images, profile, linkedin-sync, indexnow (pings IndexNow for changed posts after a deploy)
```

## SEO

- `src/lib/structured-data.ts` builds one JSON-LD `@graph` (typed with `schema-dts`): `WebSite`, `ProfilePage`, `Person` (name without diacritics and the GitHub handle as `alternateName`, Vienna, `knowsAbout`, languages, `sameAs`, résumé as `subjectOf`), one `SoftwareSourceCode` per repo in the strip (`@id` `https://stevanpavlovic.com/#repo-<name>`) and one node per product (`@id` `https://stevanpavlovic.com/#product-<key>`, `WebApplication` for hirista, `SoftwareApplication` for Safety Real Time, with `name`, `url`, the tile line as `description`, `applicationCategory` and the person as `creator`). The product nodes carry no dates (they describe his role, not the product), no `offers` or ratings and no Organization; Search Console may call them not eligible for software rich results, which is accepted. Mark up only facts the page, the résumé or the linked profiles show. Never add `worksFor`. `serializeJsonLd` escapes `<` as `\u003c` (`String.raw` in the source); check the raw bytes after editing it, as edit tools can turn the escape back into a literal `<` and make the replace a no-op.
- Dates: the sitemap `lastmod` and the `ProfilePage` `dateModified` are both the CV feed's `updatedAt` (hirista moves it on every résumé save), never the build time (blog entries use the post's `updated ?? date`, written with its own offset); Google and Bing ignore a `lastmod` that only says when the sitemap was made. URLs: Next prints the root as `https://stevanpavlovic.com` (no slash) in `canonical` and `og:url`, so the sitemap, the JSON-LD `url` fields and the `llms.txt` link use that form too; only the `@id` values keep the `/#fragment` form.
- GitHub and LinkedIn links carry `rel="me"`. The meta description names Vienna; the title does not, by the user's choice.
- IndexNow: `public/ee32ef309c036fb4c6b716d08e9bf922.txt` holds the key (public by design, with a header rule that detaches the CSP). After a content change, tell Bing and other engines with `curl -X POST https://api.indexnow.org/IndexNow -H 'Content-Type: application/json' -d '{"host":"stevanpavlovic.com","key":"ee32ef309c036fb4c6b716d08e9bf922","keyLocation":"https://stevanpavlovic.com/ee32ef309c036fb4c6b716d08e9bf922.txt","urlList":["https://stevanpavlovic.com/"]}'`. Google does not use IndexNow; it needs Search Console.
- Cloudflare lets AI crawlers in, training crawlers (`GPTBot`, `ClaudeBot`, `CCBot`) included: Security, Settings, "Configure AI bot policies" has Training on Allow, and AI Crawl Control blocks only `Bytespider`. So Cloudflare prepends no `Disallow` rules to `robots.txt`. That is a dashboard setting, not code.

## Accessibility

WCAG 2.1 AA; the pause button covers 2.2.2 (Pause, Stop, Hide). Focus rings via `.focus-ring`. Axe finds 0 violations at three sizes; contrast over the sky is measured by hand. Don't lower `--primary` / `--muted-foreground` contrast (8.0:1 and 6.4:1 on `--background`). Icon-only links carry `aria-label`; tooltips are `role="tooltip"` and dismiss on Escape.

## Skills

- Visual work: `frontend-design`. three.js globe and the WebGL planets: `threejs-skill-router`, check with `threejs-visual-validation`.
- Performance: `cloudflare:web-perf`. SEO and metadata: `seo`. Accessibility: `design:accessibility-review`.
- Hosting config: `cloudflare:wrangler`. Runtime check: `next-dev-loop` against `pnpm dev`; screenshots: `playwright-cli`.
- Measure with Lighthouse, axe-core and Playwright from outside the repo; keep test scripts, reports and screenshots tooling out of it (only the README hero image lives in `.github/assets/`; the one exception is `scripts/generate-images.ts`, which makes the social images in CI). Before done: `superpowers:verification-before-completion`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
