# CLAUDE.md

A contact card over a painted WebGL sky, a `/work` page, an `/about` page, a blog of MDX posts and a 404.
The sky shows the real sun and moon and the live weather. Vienna is the default place.
A visitor can pick their own place by location or on a night globe.
A Cloudflare Worker serves `/mcp` and `/where`.

This repo inherits the harness (commits, secrets, workflow, writing) from `~/dotfiles`.
This file holds project facts only. Long notes are in `docs/architecture.md`.
Path rules in `.claude/rules/` load when you touch matching files:
`card.md` (card, footer, /work), `motion.md` (motion switch, dock, privacy), `sky.md` (sky, shaders, globe), `blog.md` (posts, blog code).

## Stack

- Astro 7 static (`build.format: "file"`), React 19 islands, Tailwind v4, MDX, pnpm 12, Node 24.
- One Cloudflare Worker for `/mcp` and `/where`. three.js loads only in the lazy globe chunk.
- Posts are an Astro content collection (`src/content.config.ts`). Frontmatter dates must be quoted.
- The sky starts from `src/lib/sky-mount.ts` through `src/components/space-background.astro`.
- The blog has no posts yet. The code, the 30 dev-only test posts and `pnpm dev:many` stay.

## Owner rules

- `GITHUB_TOKEN` is required for the build. It is a Cloudflare build variable. Locally `github.ts` asks `gh auth token`. A non-200 answer fails the build on purpose.
- The résumé is the committed `src/data/cv.json`. Keep `basics.phone` empty. Move `updatedAt` on every edit: it is the sitemap `lastmod` and the `ProfilePage` `dateModified`.
- The owner has no iPhone. Never suggest a real-iPhone check. Emulate WebKit.
- Every push to `main` deploys on Cloudflare. Never run `wrangler deploy` or `pnpm deploy`. Never deploy by hand.
- Push only when asked. After a push, watch CI and the Cloudflare build. Wait until `https://stevanpavlovic.com/build.json` shows the new `sha` before you call it live.
- `blog-publish.yml` runs every 15 minutes and calls the deploy hook (`CLOUDFLARE_DEPLOY_HOOK`) when a scheduled post is due. Schedule a post with a future `date`.
- LinkedIn stays manual. No API edits a personal profile. Never offer to fill it through the browser. The cover image from `images.yml` is uploaded by hand.
- `pavstev/pavstev` is a generated mirror (`profile.yml`, `src/profile/`). Change the source here, never the mirror.
- Open-Meteo is CC BY 4.0. The "Weather: Open-Meteo" credit stays visible in the home footer. Only the home reads live weather.
- The site lists one product (Safety Real Time, `src/lib/products.ts`).
- No page text, meta tag, OG tag, JSON-LD node or `llms.txt` names a city. Only the résumé does. Code names such as `vienna` and `Europe/Vienna` stay.
- Never touch the Cloudflare account "Alpha.therapybg": no dashboard, no wrangler, no API, no MCP. Ask which account to use.

## Commands

```bash
pnpm dev          # astro dev on http://localhost:4321 (drafts show)
pnpm dev:many     # the same plus 30 generated test posts (BLOG_FIXTURES=1)
pnpm build        # astro build, preload guard, meta guard -> ./dist
pnpm preview      # serve ./dist on port 4321
pnpm check:fast   # prettier, eslint and related tests on changed files (--staged: staged files)
pnpm check        # types, prettier, eslint, astro check, worker tsc, tests, knip (2 passes), build, profile
pnpm types        # wrangler types and astro sync (the gitignored worker-configuration.d.ts and .astro types)
pnpm fix          # prettier --write and eslint --fix
pnpm icons        # re-extract src/lib/icon-data.ts
pnpm land         # rasterize Natural Earth land into src/assets/land-map.webp
pnpm moon         # redraw src/assets/moon-map.webp
pnpm places       # re-read GeoNames cities15000 into src/assets/places.txt
pnpm profile:build  # build the GitHub profile files into ./.profile-out
```

- The commit hook runs `pnpm check:fast --staged`. The push hook runs the full `pnpm check`. CI runs it too.
- During work, run `pnpm check:fast` once after the last edit. Run `pnpm fix` early: the lint rules are strict.
- Run the full check by hand only for proof before done. Never re-run a passing check with no edit since.
- `pnpm types` runs in `prepare` and at the start of `check`, so a fresh checkout has both generated files.

## Non-negotiables

- No comments, JSDoc, TODO, FIXME, XXX or HACK in source.
- No `eslint-disable`. Zero warnings.
- No `any` (use `unknown` or generics). No `!` non-null assertions.
- Reuse existing components. Remove duplicates in every change.
- Colors live once: CSS in `src/styles/tokens.css`, JS in `src/lib/theme.ts` and `src/lib/sky-palette.ts`. `theme.test.ts` fails on a literal elsewhere (`docs/theming.md`).
- No inline UI strings: use `src/lib/i18n.ts`. Diagram copy lives in `src/lib/blog/diagrams.ts`.
- Tailwind v4 paren syntax (`bg-(--surface)`), not brackets.
- TypeScript strict, explicit return types on exports, `import { type Foo }`, kebab-case files, PascalCase components, one component per file in `src/components/`.
- Never edit `dist/`. Never commit `.env`. Never edit the `pavstev/pavstev` mirror.
- Astro components render at build time. A React component is an island only with a `client:` directive. Browser code reads `import.meta.env`.

## Design

- interior.dev is the reference (Geist fonts). No serif.
- The sky is physically real. Do not fake it. The footer sky panel previews other hours and weather per visit, never stored.
- No boxes, shadows or rays behind text. A subtle glow is fine. Scroll bars fade at rest.
- Blog posts are in the owner's own voice.
- Every font size and gap reads the S1 tokens in `globals.css` (`--fs-*`, `--sp-*`). Exceptions: the home name, control heights, hit areas.
- Visual work: show a pick page (`ps:pick`) and ask every design question in one box, then build. A quick tweak builds at once.
- A UI change gets one `ui-verifier` sweep at the end, not one per fix round.
- Every UI change passes the mobile and a11y gate: all sizes and 200% zoom.

## Accessibility

- WCAG 2.1 AA. The Motion switch covers 2.2.2. Focus rings use `.focus-ring`.
- Do not lower `--primary` or `--muted-foreground` contrast (8.0:1 and 6.4:1 on `--background`).
- Icon-only links carry `aria-label`. Tooltips are `role="tooltip"` and dismiss on Escape.
- Axe cannot see the WebGL sky. Run axe at night for the 0-violation gate and measure day contrast by pixels.

## SEO

- `src/lib/structured-data.ts` builds one JSON-LD `@graph`: `WebSite`, `ProfilePage`, `Person`, a `SoftwareSourceCode` per repo and a node per product.
- Mark up only facts the page, the résumé or the linked profiles show. Never add `worksFor`. Product nodes carry no dates, offers or ratings.
- `serializeJsonLd` escapes `<` as `<`. Check the raw bytes after editing it: edit tools can turn the escape into a literal `<`.
- The sitemap `lastmod` and `ProfilePage` `dateModified` are the CV's `updatedAt`, never the build time. Blog entries use `updated ?? date`.
- The canonical root is `https://stevanpavlovic.com` with no slash, in `canonical`, `og:url`, the sitemap, JSON-LD `url` and `llms.txt`. Only `@id` values keep `/#fragment`.
- GitHub and LinkedIn links carry `rel="me"`.
- IndexNow: the key file is `public/ee32ef309c036fb4c6b716d08e9bf922.txt`. After a non-blog content change, POST the URL list to `https://api.indexnow.org/IndexNow` with that key.
- Cloudflare lets AI crawlers in. Only `Bytespider` is blocked. That is a dashboard setting.

## Layout

```text
src/pages/         index, work, about, 404, blog/, build.json, cv.json, llms.txt, resume.pdf, sitemap.xml
src/layouts/       Base.astro (card), BlogLayout.astro (night pages)
src/components/    card parts, site-footer.astro, sky-controls, sky-globe, space-background.astro, ui/
src/components/blog/  bar, header, TOC, mdx-components.tsx, charts, diagrams
src/lib/           sky-*, weather*, place*, motion-pause, home-effects, github, cv, i18n, theme, products, work
src/lib/blog/      schema, posts, schedule, dates, reading, plain, feeds, share, crumbs, slug
src/content.config.ts   blog and about collections
src/data/cv.json   the résumé (hand-edited)
src/styles/        tokens.css, globals.css, card.css, blog.css
src/profile/       builds the pavstev/pavstev README
content/           blog/<slug>/index.mdx, about/index.mdx
worker/            index, router, mcp, where, facts, http
scripts/           blog-fixtures, blog-publish, indexnow, guards, check-fast, generate-*
public/            _headers, fonts/, portraits/, favicons, generated og-image.jpg and linkedin-cover.png
.github/workflows/ ci, images, profile, indexnow, blog-publish
```

## Tools

- Audit kit: `node ~/powertools/tools/site-audit/audit.ts` (sizes, SEO, links, a11y, layout, contrast, shots, Lighthouse). Probes are in `~/powertools/benches/web-perf/scripts/`.
- Run heavy audits once at the end, in the background. Measure speed on a throttled phone profile.
- Worktrees: do not symlink `node_modules`. Run Playwright from `~/powertools/tools/site-audit` and open `http://localhost:4321`, not `127.0.0.1`.
- The Claude in Chrome tab is hidden. Run pointer flows in headless Playwright.
- Keep test scripts, reports and screenshot tooling out of the repo.
