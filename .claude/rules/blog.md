---
paths:
  - "content/blog/**"
  - "content/about/**"
  - "src/content.config.ts"
  - "src/pages/about.astro"
  - "src/pages/blog/**"
  - "src/layouts/BlogLayout.astro"
  - "src/styles/blog.css"
  - "src/components/blog/**"
  - "src/lib/blog/**"
  - "scripts/blog-fixtures.ts"
  - "scripts/blog-publish.ts"
  - ".github/workflows/blog-publish.yml"
  - "scripts/indexnow.ts"
---

# Blog

Siblings: `sky.md`, `card.md`, `motion.md`. The full design is in the Blog bullet of `docs/architecture.md`.

- The blog has no posts yet. `blogLive()` is false: no `/blog`, no feeds, no RSS key, no Blog button.

## Add a post

1. Make `content/blog/<slug>/index.mdx`. The slug is lowercase letters and digits in groups joined by single dashes, at most 80 characters. It is the URL.
2. Frontmatter is a strict object (`src/content.config.ts`). An unknown key fails the build. Keys: `title`, `description` (at most 160 characters), `date` (required), `updated` (optional, not before `date`), `draft`, `tags` (1 to 5).
3. Quote the dates. Unquoted, Astro turns them into a `Date` and drops the offset.
4. Write Vienna time with its offset: `+02:00` from the last Sunday of March to the last Sunday of October, else `+01:00`. A date alone fails.
5. Put images next to the post. Reference them by file name: `<Figure src="sky-storm.webp" alt="..." caption="..." />`. `alt` is required and describes the real picture. A missing file fails the build.
6. `cover.webp|png|jpg` (about 2400x1260) is the share image background. Keep a lower-left area dark, as the title is drawn there.
7. Charts: `<Chart type="bar|line|pair" src="data/<file>.json" title="..." caption="..." />`. Write `src` as `data/<file>.json`, never `./data/...`. Chart JSON is `{ "x": [...], "series": [{ "name": "...", "values": [...] }], "unit": "ms" }`: 1 to 4 series, one value per x label, non-negative, no repeated labels. `pair` needs exactly 2 labels.
8. Diagrams: `<Diagram name="site-pipeline|sky-layers|work-loop|skill-map" caption="..." />`. Diagram copy lives in `src/lib/blog/diagrams.ts`, which must not import from `@/`.
9. Link other posts with a root path (`/blog/other-slug`).
10. Run `pnpm dev` (drafts and scheduled posts show) or `pnpm dev:many`. Then `pnpm check:fast`.

## Drafts and schedule

- A future `date` hides the post until that instant (`goLiveAt` in `schedule.ts`).
- `blog-publish.yml` runs at minutes 7, 22, 37 and 52 of each hour. If a post fell due since the live `builtAt`, it calls the deploy hook, waits, then pings IndexNow. A failed run opens a `blog-publish-failed` issue.
- `scripts/blog-publish.ts` imports only `node:` modules, `schedule.ts` and `indexnow.ts`, and reads the front matter itself. Keep it so: the workflow installs nothing.
- `pnpm build` takes one instant (`BLOG_BUILT_AT`). `astro build` and `src/pages/build.json.ts` both use it.
- `BLOG_FIXTURES=1` outside `pnpm dev:many` fails the build on purpose (`fixtureGuard` in the content config).
- Dates in outputs (sitemap `lastmod`, RSS, JSON Feed, JSON-LD, Open Graph) are the instant as written, with its offset. Never append `Z`.
- Feeds stay custom (`feeds.ts`), because `@astrojs/rss` would write `pubDate` as GMT and lose the offset.

## Dates and listings

- Use `PostDate` for every post date shown on a page (formatting in `dates.ts`). Its tip shows "12:30, Stevan's time" outside Vienna. No city name.
- Two tag spellings with one slug (`tagSlug`) fail the build. `page` and `tag` are reserved slugs. There is no `/blog/page/1`.
- Listings are indexable, self-canonical and in the sitemap.

## Copy rules

- No em dashes or en dashes in posts (`content.test.ts` fails on one). No taglines. Short plain sentences, first person.
- Every claim is a measured number, a quote or a marked opinion. Say what a number counts and over what period.
- Owner quotes stay under 15 words and are exact. Never quote a secret, an email, a phone number or a private repo detail.
- UI strings go in `src/lib/i18n.ts` under `en.blog`. Post text and diagram copy do not.

## Rendering

- Components in the MDX map (`mdx-components.tsx`) render as static HTML. Props arrive with HTML names, and no `class` reaches a component. The heading anchor sets `data-heading-anchor`. `BlogLink` turns it into the class.
- Keep `<picture>` a server element. A client wrapper makes AVIF browsers fetch the WebP fallback too.
- `scripts/preload-guard.ts` fails the build when a post page holds a `rel="preload" as="image"`. Images in the bar and the sidebar stay lazy.
- Satori cannot read WebP, so the cover goes through sharp first for the share image. Pages and feeds link it with `?v=` from the drawn fields (`shareImageUrl`: title, reading time, `updated`). After a cover-only change, move `updated`.
- Markdown copies are `/blog/<slug>.md` (`plain.ts`). Nothing is written into `public/`.
- A new post element renders static markup with a selector hook and gets its behavior in `PostEffects`. Never a client component inside the MDX.

## Sky, header and bar

- The blog sky mounts once, in `BlogLayout.astro` through `space-background.astro`, and stays mounted across routes. Never mount a second one. `isSitePage` in `slug.ts` lists the routes that share it.
- Give a new blog route the shared `BlogHeader` and its crumbs, so the bar, the title morph and the ink targets work. A new page adds no header rule of its own. Only the sky story passes `header={false}`: its hero h1 is the page title.
- Only the header title and meta line sit on the bright sky. They carry `text-sky` with `postInkTargets`. New header text needs a target in `sky-ink.ts` and an `--ink` base in `globals.css`.
- Links out of the blog layout (a feed, a file) keep `data-astro-reload`. `BlogLink` adds it.
- The bar never wraps. Below 40em the name is hidden. Below 15em the current crumb and, on deep pages, the section links go. Below 11em the section links go everywhere.
- The bar is `--bar-h` (3rem), plus `--bar-sub-h` (0.75rem) on a post for the reading progress track. In-page jumps clear it through `scroll-padding-top`.
- `BarSpy` writes `--glass` and `--condense` on the bar's parent. A new bar effect reads one of them. Never use `--lift` for it: the sky probe writes `--lift`.
- The TOC has three forms in one `nav.post-toc`: the rail, the drawer and a `<details>` list without JS. Below `@container page (min-width: 80em)` the only opener is the bar key (`.blog-bar-toc`); there is no second button in the page (owner, 2026-10-24).
- TOC drawer (owner, 2026-10-24, pixel pass): a solid `--ui-panel` panel, no glass. Title and list text sit 20 px inside the panel edge; the 36 px close key is centered on the title line; list rows are 44 px tall with `--ui-radius-key` corners.
- The footer is rendered once by `BlogLayout.astro`, outside `main`.
- Bar and footer (owner pick E1, 2026-10-24): on every night page the bar row has no max width and the footer is `100% - 2 * --container-px` wide, so both end at the same side gutter.
- Wide pages (owner picks C3 and D2, 2026-10-24): a page whose content carries `.page-wide` (`/work`, `/about`, `/blog`) drops the header max width too, so the title, the content and the footer share one left edge. `/work`: from `@container page (min-width: 64em)` products sit in a left column beside the projects (1fr and 3fr). `/about`: the MDX wraps each `##` section in a plain `<section>`; from 64em they sit in three columns.

## Look

- New chrome in the bar takes the `--ui-stone-*` and `--ui-ink*` tokens, never `--foreground`. Controls follow `card.md` (D2 soft tint).
- Anything clickable inside a card needs `position: relative; z-index: 1` above the stretched title link. Never nest a link in the row link.
- Scroll bars never show at rest (`scroll-fade.ts`).
- Page slides: About, Work, Blog slide by menu order (`page-slide.ts`). Home and the 404 do not slide.
- Header gap (owner pick A2, 2026-10-24): `.blog-header` has no `min-height`. The sky fade still runs over `--head-h` (`globals.css`, `animation-range`). The dotfiles story hides its header (`story.css`).
- About header (owner, 2026-10-24): the lead is the `lead` field of `content/about/index.mdx`. `about.astro` passes it into the `BlogHeader` slot as `p.about-lead`: `--fs-base`, `text-sky`, ink target 4.5 in `sky-ink.ts`. No portrait and no TOC on /about.
- About columns (owner, 2026-10-24): keep the three sections' word counts close (about 85 to 100 each) so the columns end near each other. Never flow text across columns.
- Blog index (owner, 2026-10-24): every post is a `.mat-panel` card like `/work`. Page 1's newest post is the feature card: full row at 2 columns, a 2x2 block at 3 columns with the cover filling its left half. A lone last card spans the row. Pagination is one glass bar of 36 px keys; the current page is the filled key.

## Checks

- Run `pnpm exec prettier --write content/blog` after editing a post. It wraps long JSX props.
- Never edit `public/build.json` or generated output.
- When you touch `serializeJsonLd` or any JSON-LD string, check the raw bytes for `<`.
- IndexNow runs after a push that touches `content/blog/**`. Do not ping by hand for a post.
