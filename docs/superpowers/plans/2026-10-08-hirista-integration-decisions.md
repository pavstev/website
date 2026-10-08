# hirista.app ⇄ stevanpavlovic.com integration: decision record (2026-10-08)

**Goal:** the CV feed integration between hirista (`pavstev/jobsearch`) and the website
(`pavstev/website`) is complete, correct, documented and verified end to end, so nobody touches it
again except to rotate a secret after a leak.

## Decisions (owner, 2026-10-08)

| #   | Decision                                                                                                                                                                                                                                                                                                           | Rejected                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The website build makes `resume.pdf` from the feed JSON with `@react-pdf/renderer` (cvexp's layout ported). Spike: 84 KB, 4 pages, 0.8 s, runs anywhere. `public/resume.pdf` is deleted.                                                                                                                           | Keep the committed PDF (goes stale); a PDF route in hirista (12.44 MB > 12.10 MB Worker budget); Chrome + cvexp (Chrome in Workers Builds unknown, else a new Cloudflare API token in 4 places) |
| 2   | The website takes only the four industry popovers (company, period, link) from the feed. The card summary and `personal.ts` stay hand-written.                                                                                                                                                                     | Card summary from the feed                                                                                                                                                                      |
| 3   | Feed down at build: fall back to the live `https://stevanpavlovic.com/cv.json` only on a timeout, a network error or a 5xx. A 404, a missing variable or invalid data fails the build.                                                                                                                             | Committed snapshot; always fail                                                                                                                                                                 |
| 4   | `CV_FEED_TOKEN` stays. No rotation except after a leak (owner rule). Its homes are proven by use: GitHub CI passed on 2026-10-08 12:22 UTC with the current value.                                                                                                                                                 | Rotate once                                                                                                                                                                                     |
| 5   | Build the Ask panel now, as website plan `2026-10-08-new-pages.md` Task 9 specifies. _Removed 2026-10-08 by the owner's decision._                                                                                                                                                                                 | Out of scope                                                                                                                                                                                    |
| 6   | Popovers match a feed job by company name (`industryCompanies` map). Period: one year `2020`, ongoing `since 2022`, else `2024 to 2025`. No valid `http(s)` link: the name shows without a link. A name not in the feed fails the build. The feed wins on links (Evermed `start.evermedtv.com`, Pannovate `www.`). | An industry field in hirista                                                                                                                                                                    |
| 7   | Walls open for this run: `src/app/api/**`, `src/proxy.ts` tests, `wrangler.toml` comments. Fix every gap found, small ones too.                                                                                                                                                                                    | Keep closed                                                                                                                                                                                     |
| 8   | Website `wrangler.jsonc`: `workers_dev: false`, `preview_urls: false`.                                                                                                                                                                                                                                             | Leave the workers.dev URL on                                                                                                                                                                    |
| 9   | Build race guard: after `next build`, the website build reads the feed's `updatedAt` again and fails on purpose when the feed is newer than the built data (a newer build is on its way). Skipped when the build used the live fallback.                                                                           | No guard                                                                                                                                                                                        |
| 10  | Local website builds read the real feed through `~/work/website/.env.local`, which the owner creates.                                                                                                                                                                                                              | Read the live `/cv.json` locally                                                                                                                                                                |

## Defaults and assumptions (decided by Claude)

- jobsearch CI stays off (owner removed CI on 2026-10-05). `js.stevanpavlovic.com` keeps its 308.
- A stored résumé that fails the schema stays an empty `500` (only a caller with the valid token
  reaches it, and a 5xx makes the website fall back to the live data). Pinned by a test.
- The deploy hook fires when the save committed, even if the reply after it failed (today it needs a
  2xx too). No debounce: Cloudflare skips superseded queued builds, and the guard (decision 9) covers
  concurrent ones.
- The website fetches the feed once per build, in `scripts/cv-fetch.ts`, into the gitignored
  `.cv/cv.json`; every page, route and the PDF read that one file. The `next: { revalidate: 1 }`
  work-around goes away with the fetch inside Next.
- The feed's `pictureUrl` (`https://stevanpavlovic.com/stevan-pavlovic.jpeg`) answers 404 today. The
  website commits `public/stevan-pavlovic.jpeg`, so the link works for hirista, `/cv.json` readers and
  the PDF (which reads it from `public/`, no network).
- Contract test: jobsearch commits `fixtures/cv-feed.json` (an invented persona through the real feed
  code); the website keeps a copy in `src/lib/cv-feed.fixture.json` and parses it with `cvSchema`.
  A shape change updates both in the same session (`DEPLOYMENT.md` says so).
- `/mcp`'s fact schema (`worker/facts.ts`) gains `projects`.
- GitHub `pavstev/website`: no branch protection (the owner squashes `main` with a force push).
- The Access bypass app named in `DEPLOYMENT.md` is not needed if hirista.app has no Access app
  (its root answers 200; memory says 0 Access apps). The owner confirms in the dashboard.

## Accepted risks

- Decision 3 (owner first chose a committed snapshot): the fallback can deploy data as old as the
  live site while hirista is down. A wrong token still fails loudly.
- Decision 5: the Ask panel adds UI, a Turnstile widget and two settings. _Removed 2026-10-08 by the owner's decision: the panel, `/api/ask` and Turnstile are gone, so the risk and the settings are too._
- Decision 1: the website PDF layout is a copy of cvexp; a later cvexp change in hirista does not
  reach it by itself.

## Out of scope

- Shrinking the hirista Worker (measured: 4.14 MB gzip of the 10 MB paid limit; the 12.10 MB budget
  is raw bytes). Offered as a separate task.
- Branch protection, jobsearch Dependabot, the `pavstev/pavstev` repo settings.

## Owner data to check in hirista before the push

The PDF prints what hirista holds: today "Pavlovic" (no ć), "Belgrade, Serbia", and no link for
167Pluto. Add `https://www.linkedin.com/company/167pluto/` as 167Pluto's website and save; that save
also proves the deploy hook.
