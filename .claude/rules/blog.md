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
- Posts and the About page are Astro content collections (`src/content.config.ts`). The dev-only test posts cover the charts and diagrams.

## Add a post

1. Make `content/blog/<slug>/index.mdx`. The slug is lowercase letters and digits in groups joined by single dashes, at most 80 characters. It is the URL.
2. Frontmatter is a strict object. An unknown key fails the build.

   ```yaml
   title: Plain title
   description: One or two sentences, at most 160 characters.
   date: "2026-10-13T09:30:00+02:00" # required, quoted, with seconds and offset
   updated: "2026-10-20T18:00:00+02:00" # optional, quoted, not before date
   draft: true # optional, default false
   tags: [AI, Workflow] # 1 to 5
   ```

3. Quote the dates. Unquoted, Astro turns them into a `Date` and drops the offset.
4. Write Vienna time with its offset: `+02:00` from the last Sunday of March to the last Sunday of October, else `+01:00`. A date alone fails.
5. Every blog page shares one sky. A post has no sky field.
6. Write Markdown with GFM. Headings h2 and h3 get anchors and a TOC entry. Name the language on code fences.
7. Put images next to the post. Reference them by file name: `<Figure src="sky-storm.webp" alt="..." caption="..." />`.
8. `alt` is required and describes the real picture. Only referenced images ship. A missing file fails the build.
9. `cover.webp|png|jpg` (about 2400x1260) is the share image background. Keep a lower-left area dark, as the title is drawn there.
10. Charts: `<Chart type="bar|line|pair" src="data/<file>.json" title="..." caption="..." />`. Write `src` as `data/<file>.json`, never `./data/...`.
11. Chart JSON is `{ "x": [...], "series": [{ "name": "...", "values": [...] }], "unit": "ms" }`.
    1 to 4 series, one value per x label, non-negative, no repeated labels. `pair` needs exactly 2 labels.
12. Diagrams: `<Diagram name="site-pipeline|sky-layers|work-loop|skill-map" caption="..." />`. Diagram copy lives in `src/lib/blog/diagrams.ts`, which must not import from `@/`.
13. `<Note>text</Note>` is an aside. In the Markdown copy it becomes a blockquote.
14. Link other posts with a root path (`/blog/other-slug`). External links open in a new tab by themselves.
15. Run `pnpm dev` (drafts and scheduled posts show) or `pnpm dev:many` (30 generated posts in the gitignored `blog-fixtures/`). Then `pnpm check:fast`.

## Drafts and schedule

- `draft: true` hides a post everywhere except where `showDrafts()` is true: `pnpm dev` and `BLOG_DRAFTS=1`.
- A future `date` hides the post until that instant (`goLiveAt` in `schedule.ts`). Where drafts show it carries a "Scheduled" label.
- `blog-publish.yml` runs at minutes 7, 22, 37 and 52 of each hour. If a post fell due since the live `builtAt`, it calls the deploy hook, waits, then pings IndexNow.
- `scripts/blog-publish.ts` imports only `node:` modules, `schedule.ts` and `indexnow.ts`, and reads the front matter itself. Keep it so: the workflow installs nothing.
- It needs the secret `CLOUDFLARE_DEPLOY_HOOK`. A failed run opens a `blog-publish-failed` issue.
- `pnpm build` takes one instant (`BLOG_BUILT_AT`). `astro build` and `src/pages/build.json.ts` both use it.
- `BLOG_FIXTURES=1` outside `pnpm dev:many` fails the build on purpose (`fixtureGuard` in the content config).
- Dates in outputs (sitemap `lastmod`, RSS, JSON Feed, JSON-LD, Open Graph) are the instant as written, with its offset. Never append `Z`.
- Feeds stay custom (`feeds.ts`), because `@astrojs/rss` would write `pubDate` as GMT and lose the offset.

## Dates, reading time, tags

- `PostDate` prints the Vienna date in the server HTML, then relative text within 7 days or the date in the reader's zone.
- Its tip shows the full date and time in the reader's zone and, outside Vienna, "12:30, Stevan's time". No city name.
- Use `PostDate` for every post date shown on a page. Formatting lives in `dates.ts`.
- Reading time (`reading.ts`) counts visible words at 238 a minute, code at 119, plus 12 s per image and 20 s per chart or diagram. One value feeds header, list, share image and JSON-LD.
- Tag chips link to `/blog/tag/<slug>` (`tagSlug`). Two spellings with one slug fail the build.
- `/blog` shows 10 posts a page. There is no `/blog/page/1`. `page` and `tag` are reserved slugs.
- The page links are a window (`pageWindow`): first, last, current and one neighbor each side.
- Listings are indexable, self-canonical and in the sitemap.

## Copy rules

- No em dashes or en dashes in posts (`content.test.ts` fails on one). No taglines. Short plain sentences, first person.
- Every claim is a measured number, a quote or a marked opinion. Say what a number counts and over what period.
- Owner quotes stay under 15 words and are exact. Never quote a secret, an email, a phone number or a private repo detail.
- UI strings go in `src/lib/i18n.ts` under `en.blog`. Post text and diagram copy do not.

## Rendering

- Pages call `getEntry` and `render()`. The MDX component map is `src/components/blog/mdx-components.tsx`.
- Components in the map render as static HTML. Props arrive with HTML names, and no `class` reaches a component.
- The heading anchor sets `data-heading-anchor`. `BlogLink` turns it into the class.
- Images go through `post-image.astro` and `post-figure.astro` with Astro's `<Picture>` (AVIF and WebP, 480, 768, 1344 px). The first image is eager.
- Keep `<picture>` a server element. A client wrapper makes AVIF browsers fetch the WebP fallback too.
- `scripts/preload-guard.ts` fails the build when a post page holds a `rel="preload" as="image"`. Images in the bar and the sidebar stay lazy.
- The blur placeholder is a 16 px WebP data URI made with sharp (`blurOf`). `PostEffects` develops it in 650 ms (`data-instant` skips it).
- The share image is drawn by satori at `/blog/<slug>/share.png` (`share.ts`, `src/pages/blog/[slug]/share.png.ts`). Satori cannot read WebP, so the cover goes through sharp first. Pages and feeds link it with `?v=` from the drawn fields (`shareImageUrl`: title, reading time, `updated`), so social previews refresh after an edit. After a cover-only change, move `updated`.
- Markdown copies are `/blog/<slug>.md` (`plain.ts`). Nothing is written into `public/`.
- `PostEffects` attaches behavior to static markup by selector: blur-up, the lightbox and sortable chart tables.
- A new post element renders static markup with a selector hook and gets its behavior in `PostEffects`. Never a client component inside the MDX.

## Sky, header and bar

- The blog sky mounts once, in `BlogLayout.astro` through `space-background.astro`, and stays mounted across routes. Never mount a second one.
- `/work` and `/about` use this layout. `isSitePage` in `slug.ts` lists the routes that share the sky.
- Give a new blog route the shared `BlogHeader` (`blog-header.astro`) and its crumbs, so the bar, the title morph and the ink targets work.
- Only the header title and meta line sit on the bright sky. They carry `text-sky` with `postInkTargets`. New header text needs a target in `sky-ink.ts` and an `--ink` base in `globals.css`.
- The prose sits on the faded sky. Cards are solid panels.
- Links out of the blog layout (a feed, a file) keep `data-astro-reload`. `BlogLink` adds it.
- The bar never wraps. Its left end is one `nav[aria-label="Site"]`: the breadcrumb list (`crumbs.ts`) and the other sections after middle dots (`navOthers`).
- The last crumb truncates. Below 40em the name is hidden. Below 15em the current crumb and, on deep pages, the section links go. Below 11em the section links go everywhere.
- The bar is `--bar-h` (3rem), plus `--bar-sub-h` (0.75rem) on a post for the reading progress track. In-page jumps clear it through `scroll-padding-top`.
- `BarSpy` writes `--glass` and `--condense` on the bar's parent. A new bar effect reads one of them. Never use `--lift` for it: the sky probe writes `--lift`.
- The bar surface (`.blog-bar-glass`) is a 5rem blur-fade layer with no border and no shadow.
- The TOC has three forms in one `nav.post-toc`: the rail, the drawer and a `<details>` list without JS. From `@container page (min-width: 80em)` the rail shows.
- The footer holds the contact keys. `BlogLayout.astro` renders it once, outside `main`.

## Look

- The blog chrome follows interior.dev: dark panels, D2 soft tint for controls (see `card.md`), Geist.
- Use the `--ui-stone-*` tokens for parts that copy an interior demo and `--ui-ink*` for docs-page parts.
- New chrome in the bar takes these tokens, never `--foreground`.
- Index page 1 shows the newest post as a `.post-feature` card with its cover. Other rows are calm: no panel, a hairline between rows.
- Anything clickable inside a card needs `position: relative; z-index: 1` above the stretched title link. Never nest a link in the row link.
- Code blocks are a `.mat-panel` with a head, the language and a copy key. Notes are `.mat-panel` boxes.
- Scroll bars never show at rest (`scroll-fade.ts`).
- Page slides: About, Work, Blog slide left or right by menu order (`page-slide.ts`). Home and the 404 do not slide.
- On a fine pointer `html` has `overscroll-behavior-y: none`.
- Every night page gets its header from `BlogHeader`. A new page adds no header rule of its own.

## Checks

- Run `pnpm exec prettier --write content/blog` after editing a post. It wraps long JSX props.
- Never edit `public/build.json` or generated output. `build.json` comes from `src/pages/build.json.ts`.
- When you touch `serializeJsonLd` or any JSON-LD string, check the raw bytes for `<`.
- IndexNow runs after a push that touches `content/blog/**`. Do not ping by hand for a post.
