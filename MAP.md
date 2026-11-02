<!-- ps:map -->

# Map

My personal site: a static Astro site with a painted WebGL sky, a blog, and one Worker for the routes /mcp and /where. See [README.md](README.md) and [docs/architecture.md](docs/architecture.md).

## Folders

| Path                        | Holds                                                                     | Read it when                      |
| --------------------------- | ------------------------------------------------------------------------- | --------------------------------- |
| `src/pages/`                | routes: home, work, about, blog, the build.json marker, sitemap, llms.txt | adding or changing a route        |
| `src/layouts/`              | the page layouts                                                          | changing the shell of every page  |
| `src/components/`           | Astro and React components                                                | changing the page                 |
| `src/components/blog/`      | blog components, charts and diagrams                                      | changing the blog look            |
| `src/components/ui/`        | shared React controls                                                     | reusing a control                 |
| `src/components/sky-story/` | the sky story page parts                                                  | changing the sky story            |
| `src/components/story/`     | the dotfiles story page parts                                             | changing the dotfiles story       |
| `src/lib/`                  | pure logic: sky, theme, i18n, structured data                             | changing behavior                 |
| `src/lib/blog/`             | blog loading, marker, diagrams                                            | changing the blog build           |
| `src/lib/story/`            | story page logic                                                          | changing a story page             |
| `src/data/`                 | the résumé, the dotfiles story copy and stats                             | editing content                   |
| `src/styles/`               | CSS tokens and global styles                                              | changing the look                 |
| `src/profile/`              | the GitHub profile mirror build                                           | changing the profile files        |
| `src/assets/`               | images and the résumé PDF used by the build                               | changing an asset                 |
| `content/`                  | MDX content outside the blog code                                         | editing the about text            |
| `worker/`                   | the Cloudflare Worker for the routes /mcp and /where                      | changing the Worker               |
| `scripts/`                  | build guards, generators, IndexNow, blog publish                          | changing the build or a generator |
| `scripts/audit/`            | the checks that `pnpm audit:site` runs                                    | changing the audit                |
| `public/`                   | fonts, portraits, icons, `_headers`, the IndexNow key file                | changing static files             |
| `docs/`                     | architecture and theming notes                                            | looking for a decision            |
| `.github/workflows/`        | CI, blog publish, images, IndexNow, profile                               | changing CI or a schedule         |
| `.husky/`                   | pre-commit and pre-push hooks                                             | changing a git hook               |
| `.claude/`                  | agents, agent map and rules                                               | changing how Claude works here    |

## Find it fast

- The résumé (`updatedAt` moves on every edit): `src/data/cv.json`
- The dotfiles story copy: `src/data/dotfiles-story.ts`
- The live build marker (sha and builtAt): `src/pages/build.json.ts`
- Colors in JS: `src/lib/theme.ts`
- UI strings: `src/lib/i18n.ts`
- JSON-LD and its escape: `src/lib/structured-data.ts`
- The Worker entry and config: `wrangler.jsonc`
- The fast check: `scripts/check-fast.ts`
- The audit entry: `scripts/audit/index.ts`
- The Astro config: `astro.config.mjs`

## Commands

The real list is the scripts in `package.json`. The fast check is `pnpm check:fast`.

## Notes
