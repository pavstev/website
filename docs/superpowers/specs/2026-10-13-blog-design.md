# Blog for stevanpavlovic.com: design

Date: 2026-10-13. Branch: `blog` (worktree `/Users/pavstev/work/website-blog`). Research: `~/.claude/research/2026-10-13-blog.md`. Session digests: `~/.claude/research/2026-10-13-blog/sessions/` (A website story, B AI usage, C other projects).

## Goal

Add a `/blog` index and two posts of about 10 minutes each, written in MDX, published by the normal build, previewed per branch on Cloudflare, without making the home page slower or different (except one new button).

## Owner decisions (2026-10-13, three question rounds)

- Voice: first person as Stevan. No note that Claude drafted the posts (accepted risk).
- May be public: real session numbers (no money, no plan name), short quotes of the owner (under 15 words), other project names (hirista, pickwise, Safety Real Time, powertools). No screenshots of tools, no screenshots of the site.
- Images: charts from session data, diagrams, still frames of the sky shader.
- URLs: `/blog` and `/blog/<slug>`.
- Home: one more glass icon button in the contact row, linking to `/blog`. The card keeps its height.
- Index: moons around the portrait, constellation lines between posts that share a topic, and each post owns a sky (weather and hour). Claude picks the mix (below).
- Post page: the post's sky as the header, calm dark text below; the sky stops drawing when it is off screen.
- Extras: RSS feed, a share image per post, an IndexNow ping after a production deploy, Markdown copies for AI tools (listed in `llms.txt`, served by `/mcp`). Drafts show only on preview builds.
- Tone of the AI post: candid, with the failures and the rules they became. The website story starts on 2026-10-05.
- Go live: Claude finishes on the preview URL; the owner reads both posts there and says go; then one squashed commit lands on `main`.

## Posts

| Slug                       | Title                    | Sky          | Source          |
| -------------------------- | ------------------------ | ------------ | --------------- |
| `how-i-built-this-website` | How I built this website | clear, night | digest A        |
| `how-i-use-ai`             | How I use AI             | storm, dusk  | digests B and C |

About 2,200 to 2,500 words each (10 minutes at 230 words per minute). Plain, short sentences in the owner's voice; no em dashes, no taglines, no eyebrow labels, no "01 —" numbering. Every number traces to a digest file (kept in a sidecar notes file outside the repo, not in the MDX).

## Content model

```text
content/blog/<slug>/index.mdx      the post
content/blog/<slug>/*.png|*.jpg    source images (shader stills); SVG diagrams are components
content/blog/<slug>/data/*.json    chart data
```

Frontmatter, parsed with zod 4 (build fails on any error):

- `title` string, `description` string up to 160 characters, `date` ISO date, `updated` ISO date (optional), `draft` boolean (default false), `tags` 1 to 5 strings, `sky` `{ weather: WeatherState, phase: "night" | "dawn" | "day" | "dusk" }`.
- Derived: `slug`, `readingMinutes` (words / 230, code excluded, at least 1), `wordCount`, `toc` (h2 and h3).
- Drafts: shown when `WORKERS_CI_BRANCH` is set and not `main`, or in `next dev`, or when `BLOG_DRAFTS=1`. Hidden otherwise. A draft never reaches the sitemap, the feeds, `llms.txt` or `/mcp` of a production build.
- Order: `date` descending, then title.

## Rendering pipeline

- `@mdx-js/mdx` `evaluate()` inside server components at build time, with `remark-gfm`, `rehype-slug`, a heading-anchor step, Shiki through `@shikijs/rehype` with `@shikijs/transformers` for line highlights (one dark theme through CSS variables) and a TOC collector that writes to the `VFile`. Frontmatter with `vfile-matter`. Zero client JS for prose.
- If `evaluate()` fails under Turbopack, fall back to a prebuild script that compiles each post with `compile()` to a gitignored module the page imports.
- MDX components (server): `img` maps to `BlogImage`; `Figure`, `Note`, charts (`BarChart`, `LineChart`, `Heatmap`, `SplitBar`) that draw SVG at build from the JSON data and carry a visually hidden data table, diagram components (inline SVG in site tokens, with `title` and `desc`), `a` adds `rel="noopener noreferrer"` and `target="_blank"` for external links.
- A second converter turns the same MDX into plain Markdown (and HTML for RSS): JSX components become a short text fallback (a chart becomes its caption plus its data as a list; a diagram becomes its description).

## Build steps

`pnpm build` and `pnpm dev` run one prebuild script, `scripts/blog-build.ts`, after the CV fetch and before `next build`:

1. Images: each source image becomes AVIF (quality about 60, effort 6, 4:4:4) and WebP at 480, 768 and 1344 px (never upscaled), named `<name>.<hash8>.<width>.<ext>`, written to the gitignored `public/blog-media/<slug>/`. A gitignored manifest (`.blog/media.json`) holds width, height, a tiny blur placeholder and the source list. `sharp` becomes a direct devDependency (0.35.x, prebuilt binaries, no install script).
2. Share images: one 1200x630 PNG per post at `public/blog-media/<slug>/share.<hash8>.png`, drawn with Satori through `next/og` `ImageResponse` (already installed with Next; if it cannot run outside Next, `satori` plus `@resvg/resvg-wasm`): the post's committed shader still as the background, the title, the name and the reading time. Fonts: woff or ttf files (Satori cannot read woff2).
3. Markdown copies: `public/blog/<slug>.md` (gitignored), from the plain converter, with a short header (title, URL, date).
4. Build marker: `public/build.json` (gitignored) with the commit SHA (`WORKERS_CI_COMMIT_SHA`, else `git rev-parse HEAD`), for the IndexNow workflow.

`public/_headers` gains immutable caching for `/blog-media/*`, `Content-Type` with charset for `/blog/*.md`, `/blog/feed.xml` and `/blog/feed.json`, and the CSP-detach lines like the other non-HTML rules. The docs rule "no file in `public/` is generated at build time" changes to name these folders.

## Routes

- `src/app/blog/layout.tsx`: the shared shell for the index and posts: the sky (so it persists between `/blog` and a post), the pause button, the privacy dock.
- `src/app/blog/page.tsx`: the index (below), `Blog` JSON-LD node, RSS autodiscovery.
- `src/app/blog/[slug]/page.tsx`: `generateStaticParams`, `dynamicParams = false`, `generateMetadata` (title, description, canonical without trailing slash, Open Graph `article` with published and modified time, the share image, RSS autodiscovery), `BlogPosting` JSON-LD.
- `src/app/blog/feed.xml/route.ts`: RSS 2.0, `force-static`, `atom:link rel="self"`, summary in `description`, full HTML in `content:encoded` (CDATA, absolute URLs).
- `src/app/blog/feed.json/route.ts`: JSON Feed 1.1 (also the data source for `/mcp`).
- `src/app/sitemap.ts`: adds `/blog` and every post (`lastModified` = `updated` or `date`, images = share image).
- `src/app/llms.txt/route.ts`: a "Blog" section with each post linking to its `.md` copy.
- Preview builds (`WORKERS_CI_BRANCH` set and not `main`): every page gets `robots: noindex`.

## Index design (Claude's mix of the three picks)

- The live sky fills the page as on the home page. The owner's portrait sits at the top center at a smaller size, and the eclipse corona centers on it.
- Each post is a moon on a tilted elliptical orbit around the portrait: one WebGL2 canvas that reuses the planet helpers in `src/lib/planet-gl.ts`. The light comes from the eclipse, so each moon shows a real phase as it travels (dark when it passes in front, full when behind). Moon size grows with reading time. About one turn per minute.
- Hover or focus a post (its moon or its list row): the moon slows and its rim glows, thin constellation lines draw between it and the moons of posts that share a tag (an `aria-hidden` SVG layer), and the sky eases to that post's own weather and hour. Leaving returns to the live Vienna sky.
- Under the orbit: a heading and the real list (an ordered list of links): title, date, reading time, description, tags. The list is the accessible content; the moons are `aria-hidden` pointer shortcuts to the same links.
- Phones and coarse pointers: a smaller orbit; the row nearest the screen center sets the sky while scrolling; tapping a moon opens its post.
- Reduced motion or pause: moons stand still at fixed angles, lines appear without drawing, the sky snaps. No WebGL2, a software renderer, Save-Data or forced colors: CSS moons (flat circles; outlines in forced colors), no lines.
- Footer: the copyright, the RSS link and the weather credit (the index shows live weather at rest, so Open-Meteo's credit stays).

## Post page design

- Header: the post's own sky (weather and hour, no live weather, so no weather credit needed). The post's moon sits at the header center as the dark eclipse disc, and the corona centers on it. Title (Geist 600), date, reading time and tags take `text-sky` so they lift over bright skies. The sky fades into `--background` at the header bottom and stops drawing once the header leaves the screen.
- Navigation from the index: React `<ViewTransition>` (no flag needed in Next 16.3) morphs the moon into the eclipse disc and the row title into the page title; reduced motion turns it off.
- Article: 64ch measure, 18 px on phones and 19 px from 48em, line height 1.65, near-white text on `--background` (at least 7:1), Geist headings with anchor links, Inter body, Geist Mono code with Shiki colors that pass 4.5:1, figures with captions, footnotes with back links, images that open full size in a `<dialog>`.
- Table of contents: a sticky side list from 80em, a closed `<details>` above the article below that; a tiny client island highlights the current section (IntersectionObserver).
- End: previous and next post, back to the blog, the copyright.

## Sky changes (the riskiest part; the home page must not change)

`space-background.tsx` gains three things, each a no-op on the home page:

1. The corona center comes from `[data-eclipse]` (the home portrait gets the attribute too), not only `[data-card] [data-portrait]`.
2. A preset override: a `sky:preset` window event with `{ weather, phase }` or `null` eases the uniforms to that look and back to live. The post page sets its preset at mount; `?weather=` still wins for tests.
3. A header mode for posts: the canvas covers the header only, fades out at its bottom and stops when it is off screen. The text probe reads the blog's own `text-sky` targets.

## Home page

One more `contact-item` (internal link, lucide icon, its own tone, tooltip "Blog" plus "2 posts"), following the existing tooltip, proximity and focus rules. Nothing else on the home page changes.

## Machines

- `/mcp`: two new read-only tools: `posts` (title, URL, date, description, tags, Markdown URL) and `post` (input `slug`, returns the Markdown copy). Both read the static files through `ASSETS`.
- IndexNow: `.github/workflows/indexnow.yml` runs on a push to `main` that touches `content/blog/**`. It polls `https://stevanpavlovic.com/build.json` until the live SHA is the pushed commit or a newer one, then posts the new or changed post URLs, `/blog` and `/blog/feed.xml` to `api.indexnow.org` with the existing key.

## Cloudflare

- `wrangler.jsonc`: `"preview_urls": true` (an explicit `false` would turn the owner's dashboard switch off on the next deploy). Keep `"workers_dev": false`. Add `previews: { ratelimits: [the MCP_LIMITER entry] }` when the wrangler schema accepts it, because Worker Previews do not inherit production bindings; the first branch build proves `/mcp` answers on the preview.
- Preview URL for this branch: the branch preview on the owner's workers.dev subdomain. Only the owner's main Cloudflare account; never the one `CLAUDE.md` rules out.

## Docs

`docs/architecture.md` (routes, content pipeline, images, feeds, previews, the changed rules), `CLAUDE.md` (layout, commands, the one-page rule), a new path rule `.claude/rules/blog.md`.

## Tests

`node --test` for the frontmatter schema, draft rules, reading time, TOC, order, the plain converter, RSS escaping, JSON Feed shape, moon orbit math and the new MCP tools. `pnpm check` stays the one gate.

## Verification (once, at the end)

On the preview URL: both routes, feeds (W3C validator), JSON-LD, share images, the Markdown copies, `/mcp` tools; Lighthouse and axe on `/blog` and one post at three sizes; the mobile sweep (320 to 430 px, landscape, 200% zoom); the home page compared with production except the new button.

## Out of scope

Comments, tags pages, search, a newsletter, scheduled posts, screenshots, any change to the home page beyond the button.
