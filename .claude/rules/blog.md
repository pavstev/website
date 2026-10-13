---
paths:
  - "content/blog/**"
  - "src/app/blog/**"
  - "src/components/blog/**"
  - "src/lib/blog/**"
  - "scripts/blog-build.ts"
  - "scripts/indexnow.ts"
---

# Blog

Loads when you touch a post or the blog code. The full design is in the **Blog**, **Previews** and **IndexNow** bullets of `docs/architecture.md`. Sibling rules: `sky.md` (the sky modes), `card.md`, `motion.md`.

## Add a post

1. Make `content/blog/<slug>/index.mdx`. The slug is lowercase letters, digits and single dashes, and it is the URL.
2. Frontmatter (a strict object: an unknown key fails the build):

   ```yaml
   title: Plain title
   description: One or two sentences, at most 160 characters.
   date: 2026-10-13
   updated: 2026-10-20 # optional
   draft: true # optional, default false
   tags: [AI, Workflow] # 1 to 5
   sky:
     phase: dusk # night, dawn, day or dusk
     weather: storm # clear, partly, overcast, rain, snow, fog or storm
   ```

   `sky` sets the header sky of the post and the sky behind the moon on the index.

3. Write Markdown with GFM (tables, task lists, footnotes). Headings h2 and h3 get anchors and a TOC entry. Code fences use Shiki; name the language.
4. Put images next to the post and reference them by file name: `<Figure src="sky-storm.webp" alt="..." caption="..." />`. `alt` is required and must describe what the image shows. A plain `![alt](file.webp)` also works but has no caption or zoom. Only referenced images ship. A missing file fails the build.
5. `cover.webp|png|jpg` (about 2400x1260) is the background of the share image. Keep a lower-left area dark, as the title is drawn there. Stills are one frame of the real sky shader with fixed uniforms (no clock); keep them WebP or PNG.
6. Charts: `<Chart type="bar|line|pair" src="data/<file>.json" title="..." caption="..." />`. Write `src` as `data/<file>.json`, never `./data/...` (a path segment must start with a letter or digit). The JSON is `{ "x": [...], "series": [{ "name": "...", "values": [...] }], "unit": "ms" }`: 1 to 4 series, one value per x label, non-negative numbers, no repeated labels or names; `pair` needs exactly 2 x labels. Use `"unit": ""` when the number needs no unit.
7. Diagrams: `<Diagram name="site-pipeline|sky-layers|work-loop|skill-map" caption="..." />`. A new diagram is a component in `src/components/blog/diagrams/` plus an entry (title, description, labels) in `src/lib/blog/diagrams.ts`. Diagram copy stays there, not in `i18n.ts`, and that file must not import from `@/`.
8. `<Note>text</Note>` is an aside. In the Markdown copy it becomes a blockquote.
9. Link other posts with a root path (`/blog/other-slug`). External links open in a new tab by themselves.
10. Check it on a preview or with `pnpm dev` (drafts show). Then `pnpm check`.

## Drafts

`draft: true` hides a post everywhere (index, home button count, feeds, sitemap, `llms.txt`, Markdown copy, share image, `/mcp`) except where `showDrafts()` is true: a preview build (`WORKERS_CI_BRANCH` set and not `main`), `next dev` and `BLOG_DRAFTS=1`. Production never shows a draft. To publish, set `draft: false` and land the commit on `main`.

## Copy rules

- No em dashes or en dashes, no taglines, short plain sentences, first person where the owner speaks.
- Every claim is a measured number, a quote or a plainly marked opinion. Say what a number counts and over what period.
- Owner quotes stay under 15 words and are exact. Never quote a secret, an email address, a phone number or a private repo detail.
- Alt text describes the real picture, not the intent.
- UI strings (labels, tooltips, aria text) go in `src/lib/i18n.ts` under `en.blog`. Post text and diagram copy do not.

## Checks and gotchas

- `pnpm check` is the gate. It runs `scripts/blog-build.ts` through `pnpm build`, so image, chart and frontmatter errors fail it. ESLint and Prettier lint the MDX and Markdown.
- Run `pnpm exec prettier --write content/blog` after editing a post; it wraps long JSX props.
- Satori (share images) cannot read WebP. `coverData` in `scripts/blog-build.ts` converts the cover with sharp first; keep that if you touch it. Share images load Inter `latin` and `latin-ext` (400 and 600, from `@fontsource/inter`, under the names "Inter" and "Inter Ext") so `next/og` never fetches a font from Google during a build; a title with a glyph outside both subsets would make it fetch again, and `share.test.ts` fails when any request goes out.
- Headless Chromium counts as a crawler (`isCrawler`) and always gets the cloudy night sky, which ignores presets. Browser tests of post or index skies need a normal desktop `userAgent`.
- The post-mode sky must mount inside `header[data-sky-header]` (as the first child, `key={slug}`). Mounting it from a layout shows nothing in the header.
- Every code path that calls `setSkyPreset(post.sky)` must call `setSkyPreset(null)` on leave and on unmount, or the next index visit starts on the old preset.
- The index has ink targets for 8 rows (`blogRowSlots`). Raise it, and the slot count in `sky-ink.ts`, when the blog grows past 8 posts.
- New text over the sky needs `text-sky`, one of the registered class names (`.blog-heading`, `.post-row-title`, `.post-row-meta`, `.post-row-text`, `.blog-footer .tabular`, `.weather-credit`, `.post-title`, `.post-meta`) and the matching `--ink` base in `globals.css`.
- `BlogImage` sets `sizes="(min-width: 48em) min(46rem, calc(100vw - 4rem)), min(43.5rem, calc(100vw - 2.5rem))"`; it should match the prose column (46rem wide from 48em up, 43.5rem or the viewport minus 2.5rem below).
- Never edit `public/blog-media/`, `public/blog/`, `public/build.json` or `.blog/`: the prebuild writes them and they are gitignored.
- When you touch `serializeJsonLd` or any JSON-LD string, check the raw bytes for `<` (see the SEO note in `CLAUDE.md`).
- IndexNow runs on its own after a push to `main` that touches `content/blog/**`; do not ping by hand for a post.
