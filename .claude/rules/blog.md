---
paths:
  - "content/blog/**"
  - "src/pages/blog/**"
  - "src/layouts/BlogLayout.astro"
  - "src/components/blog/**"
  - "src/lib/blog/**"
  - "scripts/blog-build.ts"
  - "scripts/blog-publish.ts"
  - ".github/workflows/blog-publish.yml"
  - "scripts/indexnow.ts"
---

# Blog

Loads when you touch a post or the blog code. The full design is in the **Blog** (with **Scheduled posts**), **No previews** and **IndexNow** bullets of `docs/architecture.md`. Sibling rules: `sky.md` (the sky modes), `card.md`, `motion.md`.

## Add a post

1. Make `content/blog/<slug>/index.mdx`. The slug is lowercase letters and digits in groups joined by single dashes (at most 80 characters), and it is the URL.
2. Frontmatter (a strict object: an unknown key fails the build):

   ```yaml
   title: Plain title
   description: One or two sentences, at most 160 characters.
   date: 2026-10-13T09:30:00+02:00 # required, with seconds and offset; live at this instant
   updated: 2026-10-20T18:00:00+02:00 # optional, same form, not before date
   draft: true # optional, default false
   tags: [AI, Workflow] # 1 to 5
   ```

   Every blog page shares one sky (the clear night with corner rays); a post has no sky field.

   Write Vienna time with its offset: `+02:00` from the last Sunday of March to the last Sunday of October, else `+01:00`. Any valid offset passes; a wrong one moves the post by an hour (accepted risk). A date alone fails.

3. Write Markdown with GFM (tables, task lists, footnotes). Headings h2 and h3 get anchors and a TOC entry. Code fences use Shiki; name the language.
4. Put images next to the post and reference them by file name: `<Figure src="sky-storm.webp" alt="..." caption="..." />`. `alt` is required and must describe what the image shows. A plain `![alt](file.webp)` also works but has no caption or zoom. Only referenced images ship. A missing file fails the build.
5. `cover.webp|png|jpg` (about 2400x1260) is the background of the share image. Keep a lower-left area dark, as the title is drawn there. Stills are one frame of the real sky shader with fixed uniforms (no clock); keep them WebP or PNG.
6. Charts: `<Chart type="bar|line|pair" src="data/<file>.json" title="..." caption="..." />`. Write `src` as `data/<file>.json`, never `./data/...` (a path segment must start with a letter or digit). The JSON is `{ "x": [...], "series": [{ "name": "...", "values": [...] }], "unit": "ms" }`: 1 to 4 series, one value per x label, non-negative numbers, no repeated labels or names; `pair` needs exactly 2 x labels. Use `"unit": ""` when the number needs no unit.
7. Diagrams: `<Diagram name="site-pipeline|sky-layers|work-loop|skill-map" caption="..." />`. A new diagram is a component in `src/components/blog/diagrams/` plus an entry (title, description, labels) in `src/lib/blog/diagrams.ts`. Diagram copy stays there, not in `i18n.ts`, and that file must not import from `@/`.
8. `<Note>text</Note>` is an aside. In the Markdown copy it becomes a blockquote.
9. Link other posts with a root path (`/blog/other-slug`). External links open in a new tab by themselves.
10. Check it with `pnpm dev` (drafts and scheduled posts show), or `pnpm dev:many` to see it among 30 test posts. Then `pnpm check`.

## Drafts

`draft: true` hides a post everywhere (index, home button count, feeds, sitemap, `llms.txt`, Markdown copy, share image, `/mcp`) except where `showDrafts()` is true: `pnpm dev` and `BLOG_DRAFTS=1`. Production never shows a draft. There are no preview builds. To publish, set `draft: false` and land the commit on `main`.

## Schedule a post

Set `date` to a future instant (`2026-11-02T08:00:00+01:00`). Nothing else. The post is hidden like a draft until that instant (`goLiveAt` in `src/lib/blog/schedule.ts` is the one rule; `listPosts`, `findPost` and `visibleSources` take an optional `now` for tests). Where drafts show, a scheduled post carries a "Scheduled" label.

`.github/workflows/blog-publish.yml` runs at minutes 7, 22, 37 and 52 of every hour on `main`, with no dependency install: `scripts/blog-publish.ts` imports only `node:` modules, `schedule.ts` and `scripts/indexnow.ts`, and reads `date` and `draft` straight from the front matter (`timingOf`). Keep it that way, or the workflow needs `pnpm install` again. It compares the live `/build.json` `builtAt` with the go-live instants of the non-draft posts. If one fell between `builtAt` and now, it POSTs the deploy hook, waits for a newer `builtAt`, then tells IndexNow about the new posts, `/blog` and both feeds. A scheduled post is live within about 15 minutes plus the build. Nothing due: one log line, exit 0. It needs the GitHub Actions secret `CLOUDFLARE_DEPLOY_HOOK`; without it a run that finds a due post fails. A failed run opens a `blog-publish-failed` issue. When nothing is due, the run tells IndexNow again about posts that went live in the last 30 minutes (two runs), are in the live build and answer 200. With no readable `builtAt` it treats the last 30 minutes as due. On a scheduled run, if a post is due and the open `blog-publish-failed` issue is older than an hour (four runs), the run skips the hook, logs one line and leaves the issue open (a run by hand always tries). `pnpm build` takes one instant (`BLOG_BUILT_AT`) before anything else; the prebuild, `astro build` and `public/build.json` all use it. The pure parts (`duePosts`, `recentlyLive`, `shouldBackOff`, `timingOf`, `runPublish`) are tested with injected network calls; `node scripts/blog-publish.ts --dry-run` reports what is due and changes nothing.

Dates in outputs (sitemap `lastmod`, RSS, JSON Feed, JSON-LD, Open Graph) are the instant as written, with its offset. Never append `Z`.

## Dates on the page

`PostDate` (`src/components/blog/post-date.tsx`) prints the Vienna date in the server HTML ("13 Oct 2026"), then, in the browser, relative text within 7 days ("3 hours ago", "yesterday") or the date in the reader's zone, refreshed once a minute while visible. The date is a button: hover, focus or tap opens a tip with the full date, time and zone in the reader's zone and the Vienna time; Escape and an outside click close it. Formatting lives in `src/lib/blog/dates.ts` (tested). Use `PostDate` for every post date shown on a page.

## Reading time

`src/lib/blog/reading.ts` counts visible words only (link text, not URLs; no image paths, alt or JSX props; `caption` and `title` of `Figure`, `Chart`, `Diagram` count; headings, inline code and footnote text count; footnote markers do not) at 238 words a minute, fenced code at 119, plus 12 s per image or `Figure` and 20 s per `Chart` or `Diagram`, rounded up, at least 1 minute. One value feeds the header, the list, the share image and JSON-LD. Changing a post changes its golden numbers in `reading.test.ts`: update them in the same commit.

## Tags and pages

Tag chips link to `/blog/tag/<slug>` (`tagSlug`: "Claude Code" is `claude-code`, "Next.js" is `next-js`). Two spellings that map to one slug fail the build: pick one. `/blog` shows 10 posts, then `/blog/page/2`, and so on; tags paginate the same way (`/blog/tag/<slug>/page/2`). There is no `/blog/page/1`. The listing URLs come from `src/pages/blog/page/[n].astro`, `tag/[tag].astro` and `tag/[tag]/page/[n].astro`; `page` and `tag` are reserved post slugs. Listings are indexable, self-canonical and in the sitemap; feeds stay the full list.

## Many posts locally

`pnpm dev:many` adds 30 generated test posts (`src/lib/blog/fixture-posts.ts`, fixed seed, dated 2023 to 2025) from the gitignored `.blog/fixtures/`. They load only with `BLOG_FIXTURES=1` outside a production build and CI; `pnpm build` with `BLOG_FIXTURES=1` fails on purpose.

## Copy rules

- No em dashes or en dashes (`src/lib/blog/content.test.ts` fails on one in any post), no taglines, short plain sentences, first person where the owner speaks.
- Every claim is a measured number, a quote or a plainly marked opinion. Say what a number counts and over what period.
- Owner quotes stay under 15 words and are exact. Never quote a secret, an email address, a phone number or a private repo detail.
- Alt text describes the real picture, not the intent.
- UI strings (labels, tooltips, aria text) go in `src/lib/i18n.ts` under `en.blog`. Post text and diagram copy do not.

## Checks and gotchas

- `pnpm check` is the gate. It runs `scripts/blog-build.ts` through `pnpm build`, so image, chart and frontmatter errors fail it. ESLint and Prettier lint the MDX and Markdown.
- Run `pnpm exec prettier --write content/blog` after editing a post; it wraps long JSX props.
- Satori (share images) cannot read WebP. `coverData` in `scripts/blog-build.ts` converts the cover with sharp first; keep that if you touch it. Share images load Inter `latin` and `latin-ext` (400 and 600, from `@fontsource/inter`, under the names "Inter" and "Inter Ext") so satori never fetches a font from Google during a build; a title with a glyph outside both subsets would make it fetch again, and `share.test.ts` fails when any request goes out.
- Headless Chromium counts as a crawler (`isCrawler`) and always gets the cloudy night sky with no parallax. Browser tests of the blog sky need a normal desktop `userAgent`; on the home page `?at=<ISO instant>` also stops the crawler rule.
- The blog sky (`SpaceBackground mode="blog"`) mounts once, in `src/layouts/BlogLayout.astro`, as the first child of `[data-blog]`, and stays mounted across blog routes: the layout loads `ClientRouter` through `src/components/page-router.astro` and marks the sky (`transition:persist="sky"`) and the dock `transition:persist`, so a move between blog pages is a client navigation and the canvas survives. The home page persists the same sky island, so the brand link to `/` is a client navigation too and plays the home to blog shot in reverse (`sky.md`). Never mount a second one in a page. An island that must survive a page change needs `transition:persist="<name>"`; flags kept on `<html>` survive through `src/lib/router-flags.ts`, which copies every `data-*` attribute, so a new flag needs no change. A link to any other page outside the blog layout (a feed, a file) keeps `data-astro-reload`; `BlogLink` adds it for post body links (`leavesBlog` in `src/lib/blog/links.ts`). The card and post titles morph through `src/lib/blog/title-morph.ts` (names are set per navigation and removed when the transition ends, never in the markup). New blog routes get the sky for free; give them the shared `BlogHeader` (`src/components/blog/blog-header.astro`) so the bar, the title morph and the ink targets work.
- The sky behind text: only the header title and meta line sit on the bright part of the sky and carry `text-sky` with ink targets (`postInkTargets` and `blogIndexInkTargets`, the same `[data-sky-header] .blog-title` and `.blog-header-meta`). The cards have their own glass, and the prose sits on the faded sky (at least 9.9:1 measured). New text in the header needs `text-sky`, a target in `sky-ink.ts` and an `--ink` base in `globals.css`.
- The sticky bar is `--bar-h` (3rem) tall, plus `--bar-sub-h` (2.25rem) on a post, where the title shows in a second row (`--bar-total`, set on `.post-main`). In-page jumps land below it through `scroll-padding-top` on `html:has(.post-main)` (5.75rem) and `scroll-margin-top` on the prose headings; keep both if you change the bar height. `.blog-bar-title` has `pointer-events: none` (it hangs below the bar over the header and must not eat taps) and `.blog-crumb` sits at `z-index: 1`, so its 24 px box stays tappable when the meta line wraps (the layout audit fails a tap target under 24 px at 195 px wide and under text spacing).
- The bar's right end (`[data-bar-slot]`) holds the pause button (`<MotionToggle variant="bar" />`); the blog layout renders no corner pause button. There is no back button: the brand link (`/`) and the "Blog" link (`/blog`) replace it, and the name and nav fade in with `data-stuck`. Images in the bar and the sidebar (`AuthorPhoto`) stay `loading="lazy"`, or `scripts/preload-guard.ts` fails a post page. Wide layouts (`@container page (min-width: 80em)`, never a viewport media query, so zoomed text keeps the TOC reachable) show `BlogSide` on the left and the TOC rail on the right, with no line left of the rail and tree lines on nested h3 items (`data-branch`, `branchOf` in `src/lib/blog/toc.ts`). The TOC has three forms in one `nav.post-toc`: the rail, the drawer (`toc-drawer.tsx`, opened by any `[data-toc-open]` button) and the `<details>` list without JS; `toc-spy.tsx` marks the active link in all of them.
- List rows: the title link stretches over the card with `::after`; anything clickable inside a card (date button, tag chips) needs `position: relative; z-index: 1` to sit above it. Never nest a link in the row link. The card surface and its corner-ray glow are on `.post-row` (`::before`), so the date tip is never clipped.
- Keep `<picture>` a server element in `BlogImage`; only the `<img>` is a client part (`BlurImage`). React preloads every eager `<img>` that a server component renders outside a `<picture>`, so a client wrapper around the `<picture>` makes AVIF browsers also fetch the WebP fallback. After a change, `dist/blog/<slug>.html` must hold no `rel="preload"` with `as="image"`. `scripts/preload-guard.ts` checks this after `astro build` in `pnpm build` and fails the build on a post page that has one (`/` keeps its portrait preload on purpose).
- `BlogImage` sets `sizes="(min-width: 48em) min(43rem, calc(100vw - 4rem)), min(43rem, calc(100vw - 2.5rem))"`; it should match the prose column (`max-width: 43rem`, about 64ch at 17 px from 48em up; set in rem, not ch, because a ch width moves when the web font arrives and shifted the article by 0.139 CLS; below 48em the viewport minus 2.5rem limits it).
- Never edit `public/blog-media/`, `public/blog/`, `public/build.json` or `.blog/`: the prebuild writes them and they are gitignored.
- When you touch `serializeJsonLd` or any JSON-LD string, check the raw bytes for `<` (see the SEO note in `CLAUDE.md`).
- IndexNow runs on its own after a push to `main` that touches `content/blog/**`, and `blog-publish.yml` pings after a scheduled go-live; do not ping by hand for a post. It also tells the engines about a deleted post, or one switched back to draft, when the post was public before the push.
