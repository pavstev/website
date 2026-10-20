# CLAUDE.md

A contact card over a painted WebGL sky (the real sun and moon, the live weather, glass controls; Vienna by default, and the visitor can pick their own place by location or on a night globe), a `/work` page (open-source projects and products), an `/about` page, a blog of MDX posts (`/blog`) under the same painted sky at night with rays from the top left (the sun glides to the blog's corner on the way there), a 404 under that night sky, and a Worker for `/mcp` and `/where`.

## Tech Stack

Astro 7 (`output: "static"`, `build.format: "file"`, so `/blog` is `dist/blog.html`) with React 19 islands through `@astrojs/react`, Tailwind v4 through `@tailwindcss/vite`, pnpm 12 on Node 24, one Cloudflare Worker for `/mcp`, three.js only in the lazy globe chunk of the Mine tab. The blog has no posts yet (the code, the 30 dev-only test posts and `pnpm dev:many` stay). The long notes (CV file, GitHub data, fonts, icons, static files, products, profile mirror, Worker, blog, previews, IndexNow, checks, CI, deploy) are in `docs/architecture.md`: read the bullet for the area you change.

Path rules in `.claude/rules/` load when you touch matching files: `card.md` (card, section buttons, the /work page, topics), `motion.md` (footer motion toggle, dock, privacy, head script), `sky.md` (sky, shaders), `blog.md` (posts, blog code, how to add a post).

## Known blockers

- `GITHUB_TOKEN` is **required** for the build (profile email, LinkedIn, repo languages). Cloudflare build variable; locally `github.ts` asks `gh auth token`. Any non-200 answer fails the build on purpose.
- The résumé is the committed file `src/data/cv.json`, hand-edited and validated by `cvSchema` (`src/lib/cv.ts`) at build time. Keep `basics.phone` empty and move `updatedAt` on every edit: it is the sitemap `lastmod` and the `ProfilePage` `dateModified`.
- The owner has no iPhone. Never suggest a real-iPhone check; emulate WebKit instead.
- Every push to `main` deploys on Cloudflare. Never run `wrangler deploy` or `pnpm deploy`. Push only when asked and after `pnpm check` passes (the husky pre-commit hook runs it). Say which deployment carries a commit before calling it live. One deploy hook also builds `main`: `blog-publish.yml` runs every 15 minutes and calls it (secret `CLOUDFLARE_DEPLOY_HOOK`) when a scheduled blog post is due. Schedule a post by giving it a future `date`; see `.claude/rules/blog.md`.
- Finish: fetch first (other sessions share `main`), then one squashed commit on `main` and `git push --force-with-lease`. Watch CI and the Cloudflare build, wait until `https://stevanpavlovic.com/build.json` shows the new `sha`, pull and install in your other checkouts, then archive.
- LinkedIn stays manual. No API edits a personal profile, and the owner dropped LinkedIn filling: never offer to fill it through the browser. The cover image from `images.yml` is uploaded by hand.
- `pavstev/pavstev` is a generated mirror of this site (`profile.yml`, `src/profile/`). Change the source here, never the mirror.
- Open-Meteo data is CC BY 4.0: the "Weather: Open-Meteo" credit link stays visible in the home footer (`site-footer.astro`; `en.weather`), and "Open-Meteo" never breaks at its hyphen. Only the home reads live weather: /work, /about, the blog, posts and the 404 draw a fixed calm night and never ask Open-Meteo, so their footers have no credit and no sky pill. If a night page ever shows live weather again, the credit comes back there too.
- The site lists one product (Safety Real Time, `src/lib/products.ts`), not two.
- Never touch the Cloudflare account "Alpha.therapybg" (the owner's other account, under the owner's address): no dashboard, no wrangler, no API, no MCP. Ask which account to use.

## Commands

```bash
pnpm dev       # blog prebuild, then astro dev → http://localhost:4321 (drafts show)
pnpm dev:many  # the same plus 30 generated test posts (BLOG_FIXTURES=1), for pagination and tags
pnpm build     # blog prebuild, astro build, preload guard, meta guard → ./dist
pnpm preview   # astro preview: serve ./dist on port 4321
pnpm check     # prettier, eslint, astro check, worker tsc, tests, knip, build, profile  ← REQUIRED before done (also the husky pre-commit hook and CI)
pnpm fix       # prettier --write + eslint --fix
pnpm astro check   # types over .ts, .tsx and .astro (part of pnpm check)
pnpm icons     # re-extract src/lib/icon-data.ts
pnpm land      # rasterize Natural Earth 1:50m land (public domain) into src/assets/land-map.webp (the globe's continents; a local GeoJSON path may be the first argument)
pnpm moon      # redraw src/assets/moon-map.webp (fixed seed, same output every run)
pnpm places    # re-read GeoNames cities15000 into src/assets/places.txt (city names for the visitor's sky place)
pnpm profile:build  # build the GitHub profile files into ./.profile-out
```

## Non-negotiables

- **No comments, JSDoc, TODO/FIXME/XXX/HACK** in source.
- **Run `pnpm check` before declaring done.** The husky pre-commit hook runs it too, so do not run it again just before a commit. Run heavy checks (the powertools audit, Lighthouse) once at the end, in the background. Run `pnpm fix` early: the lint rules are strict.
- **Reuse existing components and remove duplicates** in every change.
- **No `eslint-disable`**: zero-warning policy.
- **No `any`** → use `unknown` or generics. **No `!`** non-null assertions.
- **Colors live once:** CSS colors in `src/styles/tokens.css`, JS colors in `src/lib/theme.ts` and `src/lib/sky-palette.ts`. Everything else reads a token. `theme.test.ts` fails on a literal anywhere else (see `docs/theming.md`).
- **No inline UI strings** → `src/lib/i18n.ts` (one exception: diagram copy lives in `src/lib/blog/diagrams.ts`, post content that the Node-side Markdown converter loads).
- **Tailwind v4 paren syntax** (`bg-(--surface)`) over bracket syntax.
- **Never edit generated files** in `dist/`. **Never commit `.env`.** **Never deploy by hand.** **Never edit `pavstev/pavstev` by hand** (the Action overwrites it).

## Design

- interior.dev is the reference (Geist fonts). No serif.
- The sky is physically real: the real sun and moon, the live weather of the chosen place. Do not fake it. The visitor may preview other hours and other weather in the footer sky panel (per visit, never stored); Live and Now are the defaults.
- No boxes, shadows or rays behind text. A subtle glow is fine. Scroll bars fade at rest.
- Blog posts are in the owner's own voice.
- Every font size and gap reads the S1 tokens in `globals.css` (`--fs-*`, `--sp-*`). The home name (`--text-display-size`), control heights and hit areas are the exceptions.
- Visual work: show a pick page (`ps:pick`) and ask every design question in one box, then build. A quick tweak builds at once with defaults.

## Code Style

TypeScript strict, explicit return types on exports, `import { type Foo }`, kebab-case files, PascalCase components, one component per file in `src/components/`.

## Layout

```text
src/pages/        index.astro (JSON-LD, sky, the card), work.astro (projects and products as rows), about.astro (text from content/about/index.mdx), 404.astro, robots.txt.ts, sitemap.xml.ts, manifest.webmanifest.ts, llms.txt.ts, cv.json.ts, resume.pdf.ts
src/pages/blog/   the index (blog.html), post pages, /blog/page/<n> and /blog/tag/<slug> listings, feed.xml and feed.json endpoints
src/layouts/      Base.astro (metadata, Open Graph `profile`, head script, sky), BlogLayout.astro
src/components/   React islands and shared parts: profile + portrait + portrait-expander, compound-text, download-button, resume-tip, contact-links, card-sections and section-links (the About, Work and Blog buttons and their tips), repo-strip and product-strip (the /work cards and rows), repo-tags (the featured card's tech tags), tech-tag (one language or technology: logo and name), product-mark, site-footer.astro (one component for the card and the night pages, static; the home gets the sky-controls island, `links` pages get the split row with the motion-switch and footer-contacts islands), footer-contacts (the GitHub, LinkedIn, Email, Résumé and RSS keys, built from `ContactKey` and `contactEntries`), motion-switch (the Motion switch),
                  page-dock, page-router.astro (ClientRouter for both layouts), privacy-note, space-background, sky-bubble (the "Moon note" that offers the visitor's own sky, home only), sky-controls (the home footer "Play with the sky" pill and its "Whose sky?" panel: three tabs, Stevan's, Mine and Custom, then Motion; it preloads the globe chunk on hover and focus of Mine), sky-globe (the lazy three.js night globe of the Mine tab), contact-key (one contact key with its tip, shared by the card and the night footer), sky-range (the Time and Weather sliders), live-status (a status line that speaks after mount), skip-link.astro, effects-init, icon,
                  topic-trigger, topic-panel, topic-heading, industry-panel
src/components/blog/  blog-header.astro (the sticky bar and the header for the index and posts), author-photo.astro, bar-spy, blog-index.astro (the shared index view), post-list.astro, post-date (date, relative text, tip), pagination.astro, tag-row.astro, post-header.astro, post-body.astro, post-toc.astro, toc-spy, toc-drawer, post-nav.astro, post-tags.astro, blog-link, blog-image, figure, post-effects (image load and zoom), note, chart (+ chart-rows, chart-line, chart-table), diagram (+ diagrams/)
src/lib/          personal, nav (the bar links About, Work and Blog), footer-links (the night footer keys), sitemap (the sitemap.xml writer), products, product-marks, i18n, bio, industries, github (repos, languages, contact, getProject), cv (cvSchema, parseCv, getCv over src/data/cv.json), cv-llms, cv-sample (test data), resume-pdf, resume-file, readme-html, resume-facts, anchored-popovers, work (what the /work page shows: pinned and hidden repos, products), tech-logos (languages and technology topics to logos, labels and colors), privacy-ack, motion-pause (pause flag, head script, stillQuery), scene-hold, router-flags (carries the `<html>` data flags across a `ClientRouter` swap), save-data, uniform-sink (cached uniform setter), geo (latitude and longitude, 0.1 degree rounding, distance, `sameSpot`), sky-place (the chosen place: Vienna or the visitor's, storage, `?place=`, `sky:place`), place-name and place-lookup (the offline GeoNames city list: decode, nearest place within 30 km), place-source (one cached fetch and decode of the list, shared by the globe and the name lookup), sky-tabs (the Stevan's, Mine and Custom tab rules), sky-globe (globe math: drag, inertia, zoom, keys), sky-globe-scene (the three.js scene), sky-ask (when the bubble shows, its position, the `sky:spot` event), sky-preview (the Time and Weather preview store and the live weather name), sky-range (the one range config `skyRanges`: steps, stops, icons, ticks, and the pure slider math), sky-clock (the place's time zone and clock labels), sky-clear (where still snow and rain keep clear of the card text), weather-client (the browser asks Open-Meteo: cache, tab return, `?weather=`), sky-light (physical sky colors: the color table and the cloud light), sky-palette (the painted night, overcast and rain palettes and the tints), sky-moon-shader (the moon GLSL shared by the paint program and the moon layer), moon-layer (the sharp moon canvas over the sky), sky-sun (the real sun spot beside the card, `?at=`), sky-ephemeris (the sun position), sky-moon (the real moon: position, phase, bright limb), sky-view (the painted view: horizon at 2%, 90 degrees up, and where it faces), sky-paint (the scene builder, the space band, the night look and `mixScene`), sky-paint-shader (the painted sky GLSL: cloud pass and composite), weather (Open-Meteo report to sky weather: layers, haze, rain strength, wind drift), sky-tween (the home to blog shot: timing, path, pose), theme (hex for theme-color, sky palette, productPalette, inkPalette), sky-preset (the sky mode type), sky-rays (the shooting star path and its start, shared with the image generator), sky-shader (the vertex shader), sky-ink (text over the sky: targets, lift, glow), sky-probe (reads the sky behind text), crawler (bot user agents get the night sky), github,
                  frame-clock, intro, portrait-effects, portrait-lens (dither lens), portrait-halo (dither halo), portrait-dither (pure math), portrait-expand, contact-links, download-ring,
                  cursor, webgl, icon-data
src/lib/blog/     schema, posts, schedule (go-live instant, scheduled posts), dates (Vienna date, relative date, tip lines), reading (reading time), tags, pagination, listing and listing-route (index, tag and page listings), fixture-posts (30 dev-only test posts), build-env (drafts, fixtures, robots), format (reading time label, post title), links (external link test), slug (routes: `isBlogPage`, `isSitePage` for the blog, /work and /about), about (reads content/about/index.mdx), render (`evaluate()`), plain (Markdown and feed HTML), toc, anchors, media (hashed names, manifest), share (share images), metadata, feeds, chart-data, chart-layout, diagrams (diagram copy lives here, not in i18n), diagram-ink, title-morph (the card to post title morph over `ClientRouter`), tests
src/assets/       moon-map.webp (the drawn moon map, 512 x 512, made by `pnpm moon`, imported with `?url`), land-map.webp (the globe's land mask, 2048 x 1024, made by `pnpm land` from `scripts/generate-land-map.ts` over `scripts/land-map.ts`, loaded with the globe chunk through `?url`)
src/data/         cv.json (the résumé, hand-edited; phone empty, updatedAt moved on every edit)
src/styles/       tokens.css (every color: primitives, semantic and UI tokens, the night lift, the day mode, fallbacks, print), globals.css (shared: imports tokens.css, fonts, type utilities, sky, materials, keycaps, tips, drawers, dock, privacy, footer motion toggle), card.css (card-only rules, starts with `@import "./globals.css"`), blog.css (blog-only rules, same import)
content/blog/     <slug>/index.mdx, data/*.json for charts, stills and cover.webp per post
content/about/    index.mdx (the About page text; title and description frontmatter only)
public/           stevan-pavlovic.jpeg, portraits/, fonts/, favicons, og-image.jpg and linkedin-cover.png (both generated in CI), _headers; generated and gitignored: blog-media/, blog/ (Markdown copies), build.json
src/profile/      types, text, readme (tables), render (pure), validate, cli, tests
worker/           index (entry), router (paths to handlers), mcp (/mcp), where (/where: the rough city from `request.cf`, no weather), facts (cv.json + llms.txt reader and text helpers), http, tests, tsconfig.json
wrangler.jsonc    assets, run_worker_first, MCP_LIMITER, `preview_urls: false`; worker-configuration.d.ts is generated from it
scripts/          blog-build.ts, preload-guard.ts and meta-guard.ts (the 404 stays noindex and the share titles follow the page title; run by `pnpm build`, blog-build also runs in `pnpm dev`), indexnow.ts (indexnow.yml), generate-icon-data.ts (pnpm icons), generate-land-map.ts (pnpm land, over land-map.ts), generate-moon-map.ts (pnpm moon, over moon-map.ts), generate-images.ts (images.yml), blog-publish.ts (blog-publish.yml, every 15 minutes: builds the site when a scheduled post is due), all run by Node's type stripping
.blog/            gitignored: media.json (hashed image manifest), written by blog-build
.github/workflows/  ci, images, profile, indexnow (pings IndexNow for changed posts after a deploy)
```

## SEO

- `src/lib/structured-data.ts` builds one JSON-LD `@graph` (typed with `schema-dts`): `WebSite`, `ProfilePage`, `Person` (name without diacritics and the GitHub handle as `alternateName`, `knowsAbout`, languages, `sameAs`, résumé as `subjectOf`), one `SoftwareSourceCode` per repo in the strip (`@id` `https://stevanpavlovic.com/#repo-<name>`) and one node per product (`@id` `https://stevanpavlovic.com/#product-<key>`, `SoftwareApplication` for Safety Real Time, with `name`, `url`, the tile line as `description`, `applicationCategory` and the person as `creator`). The product nodes carry no dates (they describe his role, not the product), no `offers` or ratings and no Organization; Search Console may call them not eligible for software rich results, which is accepted. Mark up only facts the page, the résumé or the linked profiles show. Never add `worksFor`. `serializeJsonLd` escapes `<` as `\u003c` (`String.raw` in the source); check the raw bytes after editing it, as edit tools can turn the escape back into a literal `<` and make the replace a no-op.
- Dates: the sitemap `lastmod` and the `ProfilePage` `dateModified` are both the committed CV's `updatedAt` (`src/data/cv.json`; move it on every résumé edit), never the build time (blog entries use the post's `updated ?? date`, written with its own offset); Google and Bing ignore a `lastmod` that only says when the sitemap was made. URLs: the canonical root is `https://stevanpavlovic.com` (no slash) in `canonical` and `og:url`, so the sitemap, the JSON-LD `url` fields and the `llms.txt` link use that form too; only the `@id` values keep the `/#fragment` form.
- GitHub and LinkedIn links carry `rel="me"`. No page text, meta tag, OG tag, JSON-LD node or `llms.txt` names a city (owner 2026-10-20: no Vienna on the site); only the résumé (`src/data/cv.json`, the PDF) does. Code names such as the `vienna` coordinates and the `Europe/Vienna` time zone stay, as no visitor sees them.
- IndexNow: `public/ee32ef309c036fb4c6b716d08e9bf922.txt` holds the key (public by design, with a header rule that detaches the CSP). After a content change, tell Bing and other engines with `curl -X POST https://api.indexnow.org/IndexNow -H 'Content-Type: application/json' -d '{"host":"stevanpavlovic.com","key":"ee32ef309c036fb4c6b716d08e9bf922","keyLocation":"https://stevanpavlovic.com/ee32ef309c036fb4c6b716d08e9bf922.txt","urlList":["https://stevanpavlovic.com/"]}'`. Google does not use IndexNow; it needs Search Console.
- Cloudflare lets AI crawlers in, training crawlers (`GPTBot`, `ClaudeBot`, `CCBot`) included: Security, Settings, "Configure AI bot policies" has Training on Allow, and AI Crawl Control blocks only `Bytespider`. So Cloudflare prepends no `Disallow` rules to `robots.txt`. That is a dashboard setting, not code.

## Accessibility

WCAG 2.1 AA; the Motion switch in the footer sky panel covers 2.2.2 (Pause, Stop, Hide). Focus rings via `.focus-ring`. Axe finds 0 violations at three sizes; contrast over the sky is measured by hand. Don't lower `--primary` / `--muted-foreground` contrast (8.0:1 and 6.4:1 on `--background`). Icon-only links carry `aria-label`; tooltips are `role="tooltip"` and dismiss on Escape.

## Skills

- Visual work: `frontend-design`.
- Performance: `cloudflare:web-perf`. SEO and metadata: `seo`. Accessibility: `design:accessibility-review`.
- Hosting config: `cloudflare:wrangler`. Runtime check: `pnpm dev` (Astro dev server); screenshots: `playwright-cli`.
- Checks use the powertools kit: `node ~/powertools/tools/site-audit/audit.ts` (sizes, SEO, links, a11y, layout, contrast, shots, Lighthouse), and `~/powertools/benches/web-perf/scripts/` (`site-probe.mjs`, `axe-check.mjs`, `visual-diff.mjs`, `lh-runs.sh`). Every UI change gets the mobile and a11y gate: all sizes and 200% zoom. Measure speed on a throttled phone profile.
- Worktrees: do not symlink `node_modules`. Run Playwright from `~/powertools/tools/site-audit` (it has Playwright), and open `http://localhost:4321`, not `127.0.0.1`. The Claude in Chrome tab is hidden, so run pointer flows in headless Playwright.
- Measure with Lighthouse, axe-core and Playwright from outside the repo; keep test scripts, reports and screenshots tooling out of it (the one exception is `scripts/generate-images.ts`, which makes the social images in CI). Before done: `superpowers:verification-before-completion`.

## Astro notes

- Docs: <https://docs.astro.build>. Pages and endpoints: [routing](https://docs.astro.build/en/guides/routing/); React islands: [framework components](https://docs.astro.build/en/guides/framework-components/).
- `astro dev --background` runs the dev server in the background; manage it with `astro dev stop`, `astro dev status` and `astro dev logs`.
- Astro components render at build time and ship no JavaScript. A React component is an island only with a `client:` directive. Browser code reads `import.meta.env`, never `process.env`.
- `public/_headers` makes `/_astro/*` (hashed bundles) immutable. The CSP keeps `'unsafe-inline'` for scripts and styles because Astro inlines its island loader and small scripts.
