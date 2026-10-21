# Architecture

Project facts by area. Read the bullet for the area you change. Rules for design and behavior are in `.claude/rules/`.

## Build and framework

- Astro 7, `output: "static"`, `build.format: "file"`. `/blog` is `dist/blog.html`. Cloudflare serves it without the suffix.
- React 19 islands through `@astrojs/react`. Tailwind v4 through `@tailwindcss/vite`. MDX through `@astrojs/mdx`.
- An island hydrates only with a `client:` directive. Astro components ship no JavaScript.
- The sky, the Motion switch and the home effects are plain TypeScript started from `<script>` tags, not islands.
- Routes: `/` (`index.astro`, layout `Base.astro`), `/work`, `/about`, the blog, `404`, `sitemap.xml`, `robots.txt`, `manifest.webmanifest`, `llms.txt`, `cv.json`, `resume.pdf`, `build.json`.
- Blog routes are built only while a post is live (`blogLive`).
- `astro.config.mjs` sets `devToolbar` off, `prefetch: false`, `build.inlineStylesheets: "always"` and `optimizeDeps.include: ["three"]`.
- `island-style-to-css` in the same file removes the invalid `<style>astro-island,...` that Astro writes into the body.
- `pnpm types` (in `prepare` and at the start of `check`) runs `wrangler types` and `astro sync`. It makes the gitignored `worker-configuration.d.ts` and the `.astro` types.
- `pnpm dev` runs `astro dev`. `pnpm dev:many` first writes 30 test posts with `scripts/blog-fixtures.ts`.
- Package manager: pnpm 12 and Node 24, enforced by `engines`. All pnpm settings live in `pnpm-workspace.yaml`.
- Supply chain: one-day `minimumReleaseAge`, `trustPolicy: no-downgrade`, `blockExoticSubdeps`. Add a trust exception only as an exact `name@version` with checked evidence.

## Styles and fonts

- `globals.css` is the shared sheet. It imports `tokens.css` (every color, see `docs/theming.md`), then `@theme`, utilities, fonts, base, sky, materials, keycaps, tips, drawers, dock and privacy.
- `card.css` and `blog.css` hold rules only the card or only the blog layout can match. Each starts with `@import "./globals.css"`.
- Each page imports exactly one sheet: `index.astro` imports `card.css`, `BlogLayout.astro` imports `blog.css`, `404.astro` imports `globals.css`, `Base.astro` none.
- Never import `globals.css` next to a page sheet. Astro orders CSS modules by import depth and the layer order breaks.
- A rule moves to a page sheet only when every class in its selector is used by that route.
- `globals.css` starts with `@import "tailwindcss" source(none)` and `@source "../"`, so Tailwind scans only `src/`.
- `postcss.config.mjs` runs `scripts/postcss-color-mix.mjs`, which unwraps Tailwind's `color-mix()` fallback blocks.
- Fonts are self-hosted woff2 in `public/fonts/` with versioned names: Inter Variable, Geist Mono, Geist 600 for the name, plus small `*-extra-*` files for ć č đ š ž.
- Metric-matched `local()` fallback faces sit after each font so the swap moves nothing. Re-measure them when a font file changes.
- Do not preload fonts (it hurt LCP). To change a font, ship a new file name (`/fonts/*` is immutable).

## Icons

- `<Icon>` (`src/components/icon.tsx`) renders inline SVG from `src/lib/icon-data.ts`. Sets: `circle-flags`, `lucide`, `simple-icons`.
- A new `set:name` needs `pnpm icons`. Add the `@iconify-json/<set>` package first, run the script, then restore `package.json` and the lockfile.
- The script reads every `.ts`, `.tsx` and `.astro` file under `src`, so write each icon name as a literal string.
- `src/lib/tech-logos.ts` maps languages and technologies to logos. Its test checks each one is in `icon-data.ts`.

## GitHub data and the CV

- `src/lib/github.ts` runs at build time. `getRepos` picks repos and adds every language at 3% or more with its Linguist color (GraphQL). `getContact` reads the public email and the LinkedIn account.
- `GITHUB_TOKEN` is required. Locally `github.ts` asks `gh auth token`. Any non-200 answer, missing email or missing LinkedIn fails the build.
- The résumé is the committed `src/data/cv.json`, read once by `getCv()` in `src/lib/cv.ts` and validated by `cvSchema` (`src/lib/cv-schema.ts`, zod only, also used by the Worker).
- `parseCv` blanks `basics.phone`. Keep it empty. Move `updatedAt` to the edit time on every edit, in the Vienna offset (`2026-10-15T16:30:00.000+02:00`).
- `src/pages/cv.json.ts` serves it. `cv-llms.ts` adds Experience, Skills, Education and projects to `llms.txt`.
- `src/lib/personal.ts` holds name, title, summary, website and GitHub. All UI strings are in `src/lib/i18n.ts`.

## Products and static files

- `src/lib/products.ts` is hand-written: one product, Safety Real Time. Role, period and line come from `en.products.items`. Colors come from `productPalette` in `theme.ts`.
- `product-marks.ts` holds the mark paths. Products feed the tiles, JSON-LD, `llms.txt`, the `/mcp` `products` tool and the profile README.
- There is no committed PDF. `/resume.pdf` is rendered once per build by `resume-file.ts` with `@react-pdf/renderer` (`resume-pdf.ts`).
- `resume-facts.ts` reads the page count and size from the built PDF for the tooltip. It fails the build when it finds no page count.
- `og-image.jpg` and `linkedin-cover.png` are made by `scripts/generate-images.ts`: one frame of the night sky from `nightScene`, rendered in headless Chrome on SwiftShader.
- `.github/workflows/images.yml` runs it on a push that touches its inputs, commits changed images and pushes. A failure opens one `images-sync` issue.
- The script renders each image twice and fails when bytes differ. Only CI writes the committed files. Never edit an image by hand or commit a local render.
- Portraits and favicons are committed.

## Profile mirror

- `src/profile/` builds the README of `pavstev/pavstev` from `personal.ts`, `products.ts`, `i18n.ts` and the same `getRepos` call. Pure Markdown, no images.
- `render.ts` is pure. `cli.ts` is the only file that reads or writes. Output goes to the gitignored `.profile-out/`.
- `.github/workflows/profile.yml` pushes it with the deploy key `PROFILE_DEPLOY_KEY`, on a push that touches its inputs and daily.
- The `paths` list must hold every file `src/profile/` imports. A failed run opens a `profile-sync` issue.
- Nothing in `src/pages`, `src/layouts` or `src/components` imports this code.

## Worker

- `worker/index.ts` is `main` in `wrangler.jsonc` (`nodejs_compat`). `assets.run_worker_first` is `["/mcp", "/mcp/*", "/where"]`. Everything else is served from `dist`.
- `router.ts` sends `/where` to `where.ts` and `/mcp` to `mcp.ts`, and passes anything else to `env.ASSETS`.
- `/where` (GET or HEAD) returns `{ city, far, lat, lon }` from `request.cf`: the rough city, `far` past 100 km from Vienna, and the spot rounded to 0.1 degree. No fetch, log or storage. Other methods get 405.
- There is no Ask panel and no `/api` route. Do not add them back without a new decision.
- Bindings: `MCP_LIMITER` (20 per 60 s, keyed by `CF-Connecting-IP`, namespace `2001`) and `ASSETS`.
- `worker-configuration.d.ts` is generated by `pnpm types`, gitignored, and excluded from Prettier, ESLint and the root `tsconfig.json`. `worker/tsconfig.json` includes it.
- Errors are JSON `{ "error": code }` with `Cache-Control: no-store`.
- Every `/mcp` and `/where` answer carries the security headers (`withSecurityHeaders` in `worker/http.ts`). Keep them equal to the `/*` rule in `public/_headers`.
- `facts.ts` reads `/cv.json`, `/llms.txt` and `/blog/feed.json` from `ASSETS`. It caches the promise per origin and drops it on failure. Test fixtures are in `worker/fixtures.ts`.
- `wrangler.jsonc` has `workers_dev: false` and `preview_urls: false`. The Worker answers on the custom domain only.
- `/mcp` is a stateless MCP server (`@modelcontextprotocol/sdk`, 16 KB body cap), POST only. Eight read-only tools: `profile`, `experience`, `skills`, `projects`, `products`, `contact`, `posts`, `post`.
- `post` answers an unlisted slug with `{"error":"not_found"}` as a tool error.

## Weather and place

- Only the home reads live weather. Night pages draw a fixed calm night (`nightWeather`) and never ask Open-Meteo.
- The browser asks Open-Meteo (`weather-client.ts`). `connect-src` allows `https://api.open-meteo.com`.
- It asks once when the sky starts on the home on a full load, once after a place change, and when a hidden tab returns after 30 minutes. No interval, no fetch while hidden.
- The last report per rounded place is kept in `sessionStorage` for 15 minutes. The timeout is 8 s. Any failure keeps `fallbackWeather` (partly cloudy).
- Night pages, crawlers, Save-Data and `?weather=` skip the fetch (`weatherAllowed`). `skyWeather` in `weather.ts` maps the report to layers, haze, rain, snow and fog. The parser is hand-written.
- The place is Vienna or the visitor's (`sky-place.ts`). `localStorage` key `sky-place` holds only the rounded `lat`, `lon` and `label`. `?place=<lat>,<lon>` pins one. Crawlers get Vienna.
- Every visitor place is rounded to 0.1 degree before anything else sees it.
- The name comes from the offline GeoNames list `src/assets/places.txt` (`pnpm places`, one row per 0.1 degree cell). `place-source.ts` fetches it only when needed. `nearestPlace` takes the closest place within 30 km.
- Nothing about the position goes to the Worker or any server. This keeps the panel's promise: "Rounded to about 10 km. Kept only on this device."
- GeoNames is CC BY 4.0. The open panel carries "City names: GeoNames" whenever a name shows.
- Open-Meteo is CC BY 4.0. The home footer carries "Weather: Open-Meteo". Do not add another data source without a visible credit.
- The location is asked only after a click, with `getCurrentPosition` (`enableHighAccuracy: false`, `maximumAge` 30 minutes, `timeout` 10 s).
- Open-Meteo sees the visitor's IP address and the rounded place. The privacy note says so (`en.privacy`).
- `?at=<ISO instant>` pins the time and marks the page as a real browser. The Time and Weather preview is per visit and never stored (`sky.md`).
- The bubble (`sky-bubble.tsx`, rules in `sky-ask.ts`) shows once per visitor (`sky-place-asked`), 6 s after the sky runs, only when `/where` says the visitor is over 100 km from Vienna.
- It never shows for crawlers, Save-Data, `?place=` or a saved place. `?bubble=<city>` forces it. `astro dev` has no Worker, so no bubble.
- The globe land map `src/assets/land-map.webp` is made by `pnpm land` from Natural Earth 1:50m (public domain). Run it only when the source or look changes.

## Blog

- Posts are an Astro content collection: `src/content.config.ts` defines `blog` (glob loader over `content/blog/*/index.mdx`) and `about`. Add-a-post steps are in `.claude/rules/blog.md`.
- `src/lib/blog/schema.ts` holds the strict zod frontmatter. Dates are full ISO 8601 with an offset and must be quoted.
- `posts.ts` lists and finds posts. `schedule.ts` has the one go-live rule. `slug.ts` has `isSlug` and `isSitePage`.
- Pages: `src/pages/blog/[slug].astro`, the index `[...index].astro`, `page/[n].astro`, `tag/[tag].astro`, `tag/[tag]/page/[n].astro`, feeds, `[slug].md.ts` and `[slug]/share.png.ts`.
- `remark-gfm` is Astro's default. Markdown config in `astro.config.mjs` adds `rehype-slug`, the heading anchors and Shiki with a css-variables theme (colors in `globals.css`).
- The TOC comes from Astro `headings` (`toc.ts`). The MDX component map is `mdx-components.tsx`: `a` to `BlogLink`, `pre` to `CodeBlock`, plus `Figure`, `Note`, `Chart`, `Diagram`.
- `plain.ts` turns MDX into Markdown and feed HTML by splicing source offsets. `reading.ts` computes reading time. `mdx-tree.ts` parses once per body.
- Images: `post-image.astro` and `post-figure.astro` use Astro `<Picture>`. Images next to a post resolve through `import.meta.glob` in `post-images.ts`. Output is `/_astro/*`.
- The 16 px blur placeholder is made with sharp. The first image of a post is eager (`first-image.ts`).
- Share images are drawn with satori and sharp at `/blog/<slug>/share.png`, linked with a `?v=` version of the drawn fields (`shareImageUrl` in `images.ts`). Inter `latin` and `latin-ext` come from `@fontsource/inter`, so satori never fetches a font.
- `src/pages/build.json.ts` writes `{"sha","builtAt"}`. `pnpm build` exports `BLOG_BUILT_AT` once, and `astro build` and `build.json` both use it.
- `scripts/preload-guard.ts` and `scripts/meta-guard.ts` run after `astro build`. The first fails on an image preload on a post page. The second keeps the 404 `noindex` and the share titles equal to the page title.
- Charts read `content/blog/<slug>/data/*.json` (`chart-data.ts`). Diagrams are hand-made figures with copy in `diagrams.ts`.
- Feeds: `feeds.ts` builds RSS 2.0 and JSON Feed 1.1 with the written offset. `sitemap.xml.ts` (writer `sitemap.ts`) lists posts with `updated ?? date`, then listings.
- `llms.txt` has a `## Blog` section linking each `.md` copy. The Worker's `posts` and `post` tools read `feed.json` and the `.md` copies.
- Metadata: `blogGraph` and `postGraph` in `structured-data.ts`. A post has a canonical without a trailing slash and Open Graph `article` times.
- Test posts: `fixture-posts.ts` generates 30 posts. `scripts/blog-fixtures.ts` writes them to the gitignored `blog-fixtures/`. They never reach a real build.
- Tags and pages: `tags.ts`, `pagination.ts` (10 a page), `listing.ts`, `listing-route.ts`, `blog-index.astro`.
- Chrome: one `BlogHeader` for every night page, a sticky bar, the TOC rail and drawer, `ReadingProgress`, `PostDate`, the lightbox and sortable tables (interior.dev ports in `src/components/ui/`).
- Transitions: both layouts load `ClientRouter` through `page-router.astro`. The sky and the dock persist. `router-flags.ts` copies `<html>` `data-*` flags across a swap.
- `title-morph.ts` morphs the card title into the post title. Feeds and `/resume.pdf` carry `data-astro-reload`.
- Reduced motion and the pause zero every view transition duration.

## Work and About

- Both pages use `BlogLayout`, `BlogHeader` and the night sky. Crumbs come from `pageCrumbs`. Both are in `sitemap.xml` and `llms.txt`.
- Work lists products and repos from `work.ts`, `products.ts` and the build-time `getRepos`. See `card.md`.
- About is `content/about/index.mdx` (the `about` collection: `title` and `description` only). It renders through the same MDX pipeline as a post. Figures and charts are not supported there.
- `/work/dotfiles` is a scroll story about the dotfiles repo, entered from its `/work` card. It uses `BlogLayout` with `sky={false}`: no sky, the night footer and the dock stay. The facts come from GitHub at build (`dotfiles-facts.ts`), the copy from `src/data/dotfiles-story.ts`. A pure geometry draws an exploded isometric blueprint, once as build-time SVG posters and once live in one WebGL2 context that follows the scroll. Rules are in `.claude/rules/story.md`.

## Prefetch

- `prefetch: false` turns Astro's own prefetch off. `src/lib/link-prefetch.ts` (started from `page-router.astro`) warms same-origin pages with a plain low-priority `fetch()` on hover, focus and touch.
- Reason: Chrome sends `Sec-Purpose: prefetch` for `<link rel=prefetch>`, and Cloudflare Speed Brain answers `503` for Worker-served sites. Speed Brain is switched off in the dashboard.
- The plain `fetch()` stays because it works if Speed Brain is switched back on. HTML stays `max-age=0, must-revalidate`, so a prefetch never serves stale HTML.
- Post links on listings use `prefetch={false}`. The résumé link opts out with `data-astro-prefetch="false"`.

## No previews

- `wrangler.jsonc` has `preview_urls: false` and no `previews` block. Turn Preview Builds off in the dashboard too (Workers & Pages, the Worker, Settings, Build, Branch control).
- Check a post with `pnpm dev` or `BLOG_DRAFTS=1 pnpm build` and `pnpm preview`. A push to `main` is the only deploy.

## IndexNow

- `.github/workflows/indexnow.yml` runs on a push to `main` that touches `content/blog/**`. `scripts/indexnow.ts --sha <sha> --before <sha>` lists changed post folders.
- It polls `build.json` until the live sha is the pushed commit or a descendant, keeps post URLs that answer 200, and also sends a post that was public before and now answers 404 or 410.
- It adds `/blog` and `/blog/feed.xml` and sends one POST to `api.indexnow.org`. A failure opens an `indexnow-failed` issue.
- A scheduled go-live has no push, so `blog-publish.yml` sends those URLs itself (`postIndexNow`, `readBuildJson`, `parseBuiltAt`).
- The script imports only `node:` modules and `schedule.ts`, because the workflow installs nothing.

## Checks and CI

- `pnpm check:fast` runs Prettier, ESLint and the related tests on changed files (`scripts/check-fast.ts`). The commit hook runs it with `--staged`.
- `pnpm check` is the full gate and the push hook: `pnpm types`, Prettier, ESLint (zero warnings), `astro check`, `tsc -p worker/tsconfig.json`, tests (`node --test`, dot reporter), `knip` and `knip --production`, `pnpm build`, and the profile check.
- The production knip pass catches code that only tests import. Test-only helpers are excluded in `knip.config.ts`.
- `check` changes no tracked file. `pnpm fix` applies Prettier and ESLint fixes.
- `.github/workflows/ci.yml` runs `pnpm install --frozen-lockfile` and `pnpm check` on pushes and pull requests, and fails when the tree changes.
- `images.yml`, `profile.yml`, `indexnow.yml` and `blog-publish.yml` run on `main` only. Each opens one labelled issue on failure and closes it on the next good run.
- A push made with `GITHUB_TOKEN` starts no other workflow. Dependabot opens grouped weekly updates.

## Deploy

- Every push to `main` makes Cloudflare build the repo and publish `dist` as Workers static assets with the Worker in front of `/mcp` and `/where`.
- The build command is `pnpm run build`. The build variable is `GITHUB_TOKEN`. The Worker has no secrets.
- The GitHub secret `CLOUDFLARE_DEPLOY_HOOK` belongs to `blog-publish.yml`, not to the build.
- `public/_headers`: immutable for `/_astro/*` and `/fonts/*`, one day plus stale-while-revalidate for portraits, favicons and the share images. HTML and `resume.pdf` revalidate every time.
- `/*` carries the security headers and a CSP. Scripts and styles keep `'unsafe-inline'` for Astro's inline loader. `img-src` allows `data:` for the blur placeholders.
- Every non-HTML rule detaches the CSP and `X-Frame-Options` with `! Header-Name`. Keep the rules disjoint, as Cloudflare joins duplicate headers with a comma.
- `astro preview` ignores `_headers`. Test CSP changes on the live site.
- `/build.json` is `no-store`. After a push, wait until it shows the new `sha`.
