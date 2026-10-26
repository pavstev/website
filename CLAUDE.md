# CLAUDE.md

Project facts only. The harness (commits, secrets, workflow, writing) comes from `~/dotfiles`.
Path rules in `.claude/rules/` load when you touch matching files. Long notes: `docs/architecture.md`, `docs/theming.md`.

## Stack gotchas

- Astro 7 static with `build.format: "file"`. Node 24, pnpm 12.
- One Cloudflare Worker serves `/mcp` and `/where`. three.js loads only in the lazy globe chunk.
- Blog frontmatter dates must be quoted. The blog has no posts yet. The code, the 30 dev-only test posts and `pnpm dev:many` stay.
- An Astro component renders at build time. A React component is an island only with a `client:` directive. Browser code reads `import.meta.env`.
- Never edit `dist/`. Never commit `.env`.

## Owner rules

- `GITHUB_TOKEN` is required for the build. It is a Cloudflare build variable. Locally `github.ts` asks `gh auth token`. A non-200 answer fails the build on purpose.
- The résumé is the committed `src/data/cv.json`. Keep `basics.phone` empty. Move `updatedAt` on every edit: it is the sitemap `lastmod` and the `ProfilePage` `dateModified`.
- The dotfiles story copy is `src/data/dotfiles-story.ts`. The skill catalog is `src/data/dotfiles-stats.ts`. Move `storyMeta.updatedAt` there on every copy or catalog edit. The page shows names, never counts or the owner's own usage: `.claude/rules/story.md`.
- The owner has no iPhone. Never suggest a real-iPhone check. Emulate WebKit.
- Every push to `main` deploys on Cloudflare. Never run `wrangler deploy` or `pnpm deploy`. Never deploy by hand.
- Push only when asked. After a push, watch CI and the Cloudflare build. Wait until `https://stevanpavlovic.com/build.json` shows the new `sha` before you call it live.
- `blog-publish.yml` runs every 15 minutes and calls the deploy hook (`CLOUDFLARE_DEPLOY_HOOK`) when a scheduled post is due. Schedule a post with a future `date`. The Monday `images.yml` run calls it too when it pushes nothing, so the GitHub facts refresh weekly.
- LinkedIn stays manual. No API edits a personal profile. Never offer to fill it through the browser. The cover image from `images.yml` is uploaded by hand.
- `pavstev/pavstev` is a generated mirror (`profile.yml`, `src/profile/`). Change the source here, never the mirror.
- Open-Meteo is CC BY 4.0. The "Weather: Open-Meteo" credit stays visible in the home footer. Only the home reads live weather.
- Vienna is the default place, but no page text, meta tag, OG tag, JSON-LD node or `llms.txt` names a city. Only the résumé does. Code names such as `vienna` and `Europe/Vienna` stay.
- Never touch the Cloudflare account "Alpha.therapybg": no dashboard, no wrangler, no API, no MCP. Ask which account to use.

## Commands

- The commit hook runs `pnpm check:fast --staged`. The push hook and CI run the full `pnpm check`.
- Run `pnpm fix` early: the lint rules are strict.
- `pnpm types` writes the gitignored `worker-configuration.d.ts` and the `.astro` types. It runs in `prepare` and at the start of `check`.
- `pnpm dev:many` adds 30 generated test posts (`BLOG_FIXTURES=1`).
- `pnpm profile:build` builds the GitHub profile files into `./.profile-out`. Never name a script `profile`.

## Non-negotiables

- No comments, JSDoc, TODO, FIXME, XXX or HACK in source. Lint enforces the last four, not the first two.
- Reuse existing components. Remove duplicates in every change.
- Colors live once: CSS in `src/styles/tokens.css`, JS in `src/lib/theme.ts` and `src/lib/sky-palette.ts`. `theme.test.ts` fails on a literal elsewhere.
- No inline UI strings: use `src/lib/i18n.ts`. Diagram copy lives in `src/lib/blog/diagrams.ts`.
- Tailwind v4 paren syntax (`bg-(--surface)`), not brackets.

## Design

- interior.dev is the reference (Geist fonts). No serif.
- The sky is physically real. Do not fake it. The footer sky panel previews other hours and weather per visit, never stored.
- No boxes, shadows or rays behind text. A subtle glow is fine. Scroll bars fade at rest.
- Blog posts are in the owner's own voice.
- Every font size and gap reads the S1 tokens in `globals.css` (`--fs-*`, `--sp-*`). Exceptions: the home name, control heights, hit areas.
- Visual work: show a pick page (`ps:pick`) and ask every design question in one box, then build. A quick tweak builds at once.
- Every UI change passes the mobile and a11y gate: all sizes and 200% zoom.

## Accessibility

- WCAG 2.1 AA. The Motion switch covers 2.2.2. Focus rings use `.focus-ring`.
- Do not lower `--primary` or `--muted-foreground` contrast (8.0:1 and 6.4:1 on `--background`).
- Tooltips are `role="tooltip"` and dismiss on Escape.
- Axe cannot see the WebGL sky. Run axe at night for the 0-violation gate and measure day contrast by pixels.

## SEO

- Mark up only facts the page, the résumé or the linked profiles show. Never add `worksFor`. Product nodes carry no dates, offers or ratings.
- `serializeJsonLd` in `src/lib/structured-data.ts` escapes the less-than sign as backslash, `u003c`. Edit tools can turn that escape into a literal less-than sign. Check the raw bytes with `od -c` after you edit it.
- The sitemap `lastmod` and `ProfilePage` `dateModified` are the CV's `updatedAt`, never the build time. Blog entries use `updated ?? date`.
- The canonical root is `https://stevanpavlovic.com` with no slash, in `canonical`, `og:url`, the sitemap, JSON-LD `url` and `llms.txt`. Only `@id` values keep `/#fragment`.
- IndexNow: the key file is `public/ee32ef309c036fb4c6b716d08e9bf922.txt`. After a non-blog content change, POST the URL list to `https://api.indexnow.org/IndexNow` with that key.
- Cloudflare lets AI crawlers in. Only `Bytespider` is blocked. That is a dashboard setting (`/ai/security`).
- The site lists one product (Safety Real Time, `src/lib/products.ts`).

## Tools

- `pnpm audit:site` builds, serves `dist` with `wrangler dev` on port 8790 and writes `.audit/audit-<label>/report.md` (gitignored). Options: `--fast`, `--only a,b`, `--skip a,b`, `--no-build`, `--url`, `--baseline`. Browsers install once with `pnpm exec playwright-core install chromium webkit`. The links check needs `lychee`. Probes stay in `~/powertools/benches/web-perf/scripts/`.
- The WebKit pass strips `upgrade-insecure-requests` from the CSP, because Playwright WebKit hangs on `http://localhost` otherwise.
- Run heavy audits once at the end, in the background. Measure speed on a throttled phone profile.
- Worktrees: do not symlink `node_modules`. For your own browser runs open `http://localhost:4321`, not `127.0.0.1`.
- The Claude in Chrome tab is hidden and ignores clicks. Run pointer flows in headless Playwright.
- Reports, screenshots and one-off test scripts stay out of git.
