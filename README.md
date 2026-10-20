# stevanpavlovic.com

My personal site: a contact card over a painted WebGL sky of Vienna, a work page, an about page, a blog, and a Worker that answers questions about my CV and posts.

**Live:** [stevanpavlovic.com](https://stevanpavlovic.com)

## What is in it

- **Painted sky.** The home page has a hand-written WebGL sky in a painted style: the real Vienna sun and moon (with its phase), the live weather for Vienna or, if you share it, for your own place (rounded to about 10 km, kept only on your device), a band of space with stars at the top and paper grain. The other pages show the same painted sky, always at night, with light rays from the top left, and the sun glides between the two.
- **Glass controls.** The home buttons, tooltips and panels are translucent glass that reads on a day or a night sky.
- **Work.** [/work](https://stevanpavlovic.com/work) lists my products and open-source projects.
- **About.** [/about](https://stevanpavlovic.com/about) is a short text page.
- **Blog.** [/blog](https://stevanpavlovic.com/blog) has MDX posts with charts and diagrams, tag pages, RSS and JSON feeds, and a Markdown copy for AI tools.
- **MCP.** `POST /mcp` is a read-only MCP server (`profile`, `experience`, `skills`, `projects`, `products`, `contact`, `posts`, `post`) behind a per-IP rate limit.
- **Kind to your device.** Loops slow down when idle, pause when hidden, and stop with a "Stop motion" button or reduced motion.
- **No cookies.** Cloudflare Web Analytics counts visits without them.

## How it works

An Astro 7 static build (React 19 islands, Tailwind v4) writes one HTML file per page to `dist/`. The Worker in `worker/` runs only for `/mcp` and `/where`. `/mcp` reads `/cv.json`, `/llms.txt` and `/blog/feed.json` from the static assets. `/where` answers with the rough city from Cloudflare request data and stores nothing. The browser asks [Open-Meteo](https://open-meteo.com) (CC BY 4.0) for the weather. The résumé is the committed file `src/data/cv.json` (no phone number); data that fails its schema fails the build.

## Getting started

Node 24 and pnpm 12. The build reads the GitHub API and needs `GITHUB_TOKEN`; locally it falls back to `gh auth token`.

```bash
pnpm install
pnpm dev   # http://localhost:4321
```

| Script               | What it does                                                                  |
| -------------------- | ----------------------------------------------------------------------------- |
| `pnpm dev`           | Builds the blog media, then a dev server on port 4321 (drafts show)           |
| `pnpm build`         | Builds the blog media and `dist/`, then runs the preload and meta guards      |
| `pnpm preview`       | Serves `dist/` with `astro preview` on port 4321                              |
| `pnpm check`         | Format, lint, `astro check`, Worker types, tests, unused code, build, profile |
| `pnpm fix`           | Applies Prettier and ESLint fixes                                             |
| `pnpm icons`         | Rebuilds `src/lib/icon-data.ts`                                               |
| `pnpm profile:build` | Builds the GitHub profile into `.profile-out/` (`--check` also checks links)  |

`pnpm check` changes no file. It runs before every commit (husky) and in CI.

## GitHub profile

The README on [github.com/pavstev](https://github.com/pavstev) is generated here by `src/profile/` and pushed to `pavstev/pavstev` by `.github/workflows/profile.yml` (needs the deploy key secret `PROFILE_DEPLOY_KEY`). Never edit that repo by hand.

## Deploy

Every push to `main` makes Cloudflare build the repo and publish `dist/` with the Worker (`wrangler.jsonc`). It needs `GITHUB_TOKEN` as a build variable. A blog post with a future `date` goes live through `.github/workflows/blog-publish.yml`, which starts a build with the deploy hook `CLOUDFLARE_DEPLOY_HOOK`. Nobody deploys by hand.

## Contact

[hi@stevanpavlovic.com](mailto:hi@stevanpavlovic.com)

## License

The code is under the [MIT License](LICENSE). The portraits, the résumé and the personal text are not covered by it: see [NOTICE](NOTICE).
