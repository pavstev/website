# hirista integration (website part) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** the website reads the hirista CV feed once per build, survives a hirista outage, never
deploys data older than a newer build, makes its own résumé PDF, takes the industry popovers from
the feed, and ships the Ask panel.

**Architecture:** `scripts/cv-fetch.ts` (before `next build`) writes the feed, or the live
`/cv.json` when hirista is down, to the gitignored `.cv/cv.json`; `getCv()` reads that file for
every page, route and the PDF; `scripts/cv-guard.ts` (after `next build`) fails the build when the
feed has moved on. `resume.pdf` is a static route rendered with `@react-pdf/renderer`.

**Tech Stack:** Next 16 static export, Node 24 type stripping, `node:test`, zod 4,
`@react-pdf/renderer` 4.9, `@fontsource/inter`.

**Spec:** the decision record (copied to `docs/superpowers/plans/2026-10-08-hirista-integration-decisions.md`),
the jobsearch `DEPLOYMENT.md` section "Integration contract", and Task 9 of
`docs/superpowers/plans/2026-10-08-new-pages.md` (the Ask panel).

## Global Constraints

- Website non-negotiables: no comments or TODOs in source, no `eslint-disable`, no `any`, no `!`,
  UI strings only in `src/lib/i18n.ts`, colours only in `globals.css` or `src/lib/theme.ts`,
  `pnpm check` before done. The repo is public: never commit a secret, an email of an employer or
  a phone number.
- The only app domain is `hirista.app`; never add `js.stevanpavlovic.com`.
- No em dashes in copy. Never print `CV_FEED_TOKEN`; no error message holds the token or the URL.
- Scripts run under Node 24 type stripping: relative imports with `.ts`, no `@/` aliases in any
  file a script imports (`src/lib/cv.ts`, `src/lib/personal.ts`).
- Each agent edits only inside its own worktree `~/work/website-wt/<task>`.

## Review Focus

1. hirista hangs: the fetch stops at 20 s and the build uses the live `/cv.json` (Task 1 test).
2. A 404 (wrong token) or a missing variable: the build fails and never falls back (Task 1 test).
3. A feed company link `javascript:alert(1)`: the popover shows the name with no link (Task 3 test).
4. A name with `ć`: the PDF keeps the glyph (Task 2 test).
5. A résumé saved during the build: the guard fails the build; with the live fallback it passes
   (Task 1 test).

---

### Task 0 (orchestrator, before the agents): the base branch

- [x] `git -C ~/work/website worktree add ~/work/website-wt/base -b integration/base origin/main`,
      `pnpm install` there.
- [x] `pnpm add @react-pdf/renderer @fontsource/inter` (after the supply-chain check passes).
- [x] `wrangler.jsonc`: `"workers_dev": false`, `"preview_urls": false`. `.gitignore`: `.cv/`.
- [x] `src/lib/i18n.ts`: add `resumePdf: { education: "Education", experience: "Work Experience",
languages: "Languages", month: "month", months: "months", page: "Page {page} of {pages}",
projects: "Projects", skills: "Skills", summary: "Summary", technology: "Technology", year:
"year", years: "years" }` (cvexp's printed words).
- [x] Commit `chore: the base for the hirista integration`. Every task branches from here.

### Task 1: One feed read per build, the live fallback and the guard

**Files:**

- Modify: `src/lib/cv.ts`, `src/lib/cv.test.ts`, `package.json` (scripts only), `knip.config.ts`
- Create: `scripts/cv-fetch.ts`, `scripts/cv-guard.ts`

**Interfaces:**

- Consumes: `cvSchema`, `Cv`, `stripPrivate` (unchanged); `personalData.website` from
  `src/lib/personal.ts` (relative import).
- Produces:
  - `export type CvFeedFailure = "config" | "refused" | "unavailable" | "invalid"`
  - `export class CvFeedError extends Error { readonly kind: CvFeedFailure }`
  - `export const fetchFeed = (env: Record<string, string | undefined>, fetchImpl?: typeof fetch, timeoutMs?: number): Promise<Cv>`
    (default 20,000 ms; `config`: a variable missing or not `https`; `refused`: 404; `unavailable`:
    timeout, network error, 5xx; a redirect is `config`; `invalid`: bad JSON or schema)
  - `export const loadCv = (options: { env: Record<string, string | undefined>; liveUrl: string; fetchImpl?: typeof fetch; timeoutMs?: number }): Promise<{ cv: Cv; source: "feed" | "live" }>`
    (falls back to `liveUrl` only on `unavailable`)
  - `export const isNewer = (current: Cv, built: Cv): boolean` (by `updatedAt` instant)
  - `export const cvCachePath = ".cv/cv.json"`, `export const cvSourcePath = ".cv/source"`
  - `export const getCv = (): Promise<Cv>` (reads `cvCachePath` once per process, parses with
    `cvSchema`; missing file → `CvFeedError("config")` naming `scripts/cv-fetch.ts`)
  - Scripts: `"build": "node scripts/cv-fetch.ts && next build && node scripts/cv-guard.ts"`,
    `"dev": "node scripts/cv-fetch.ts && next dev -p 4321"`, `check` runs `pnpm build` in place of
    `next build`.

- [x] **Step 1: Write the failing tests** in `cv.test.ts`: `a hung feed stops at the timeout as
unavailable`, `a 503 is unavailable`, `a redirect is config` (a moved host is a setup error, never a fallback), `a 404 is refused`,
      `missing CV_FEED_TOKEN is config`, `http on a public host is config`, `bad JSON is invalid with a
"CV feed" message`, `a schema failure is invalid`, `no error message contains the token or the
URL` (token `tok-SECRET-123`, URL `https://feed.example`), `loadCv falls back to the live URL on
unavailable`, `loadCv never falls back on refused or config`, `isNewer compares instants`,
      `getCv reads the cache file once`. Keep the existing tests that still apply.
- [x] **Step 2:** `node --test src/lib/cv.test.ts` → FAIL.
- [x] **Step 3:** Implement in `cv.ts`. Drop `next: { revalidate: 1 }`. Keep `redirect: "error"`.
- [x] **Step 4:** `scripts/cv-fetch.ts`: `process.loadEnvFile(".env.local")` when the file exists;
      `loadCv({ env: process.env, liveUrl: `${personalData.website}/cv.json` })`; write `.cv/cv.json`
      and `.cv/source`; print one line (`CV from the feed, updatedAt …` or a warning that hirista did
      not answer and the live `/cv.json` was used); exit 1 with the error's message on failure.
      `scripts/cv-guard.ts` (loads `.env.local` the same way): source `live` → print and exit 0; else `fetchFeed`; `unavailable` → warn,
      exit 0; other failures → exit 1; `isNewer(current, built)` → exit 1 with "The résumé changed
      during this build. A newer build is on its way."; else exit 0. Add both to knip's `entry`.
- [x] **Step 5:** `node --test src/lib/cv.test.ts` → PASS; `pnpm check` up to the build (the
      build needs `.env.local`; without it, report the exact stop).
- [x] **Step 6:** Commit `feat(cv): one feed read per build, the live fallback and the guard`.

### Task 2: The résumé PDF renderer

**Files:**

- Create: `src/lib/resume-pdf.ts`, `src/lib/resume-pdf.test.ts`
- Modify: `src/lib/theme.ts` (the PDF's colours)

**Interfaces:**

- Consumes: `Cv` (`src/lib/cv.ts`), `en.resumePdf` (Task 0).
- Produces: `export const renderResumePdf = (cv: Cv, photo: Uint8Array | null): Promise<Uint8Array>`.

- [x] **Step 1: Write the failing tests** (data from `src/lib/cv-sample.ts`): `starts with %PDF`,
      `has at least one page` (`/Type /Page`), `keeps ć` (render `basics.name: "Ana Petrović"`; inflate
      the FlateDecode streams as `resume-facts.ts` does and find `0107` in a ToUnicode map), `renders
with no photo`, `skips an empty Projects section`, `links only http(s) addresses`.
- [x] **Step 2:** `node --test src/lib/resume-pdf.test.ts` → FAIL.
- [x] **Step 3:** Port the cvexp layout as the spike did
      (`<scratchpad>/spike-pdf-reactpdf/render.mjs`: A4, the same section order, sizes, colours, dashed
      dividers, "Technology:" lines, durations, "Page N of M" footer). Inter from `@fontsource/inter`
      WOFF files (latin and latin-ext, 400/500/600 and 400 italic). Colours from `theme.ts`.
- [x] **Step 4:** Same command → PASS. Commit `feat(pdf): render the résumé from the CV feed`.

### Task 3: The industry popovers from the feed (after Task 4 merges: both edit `i18n.ts`)

**Files:**

- Modify: `src/lib/industries.ts`, `src/components/industry-panel.tsx`, `src/lib/i18n.ts`
  (`industries` only)
- Test: `src/lib/industries.test.ts`

**Interfaces:**

- Consumes: `getCv()`, `Cv` (Task 1).
- Produces: `export const industryCompanies = { betting: "167Pluto", fintech: "Pannovate", fleet:
"Safety Real Time", healthtech: "Evermed" }`; `export interface IndustryJob { company: string;
period: string; site: string }`; `export const industryJob = (cv: Cv, key: IndustryKey):
IndustryJob`; `export const formatPeriod = (from: string, to: string): string`. `Industry` loses
  `company`, `period` and `site`; `companySites` and the topics' `company` and `period` strings go.
  New strings: `en.industries.since: "since {year}"`, `en.industries.range: "{from} to {to}"`.

- [x] **Step 1: Write the failing tests:** `formatPeriod("Jan 2020", "Dec 2020") === "2020"`,
      `("Apr 2022", "Present") === "since 2022"`, `("Feb 2024", "Jun 2025") === "2024 to 2025"`,
      `("2019", "") === "since 2019"`, `("", "2020")` throws; `industryJob` matches the company case- and
      space-insensitively, spans two stints (earliest from, latest to), gives `site: ""` for an empty or
      a `javascript:` link, throws `industries: <company> is not in the CV feed` when missing.
- [x] **Step 2:** `node --test src/lib/industries.test.ts` → FAIL.
- [x] **Step 3:** Implement. `IndustryPanel` becomes an async server component that calls
      `getCv()`; with `site === ""` the company is a plain `span.topic-company` with no new-tab text.
- [x] **Step 4:** Same command → PASS; `pnpm check` (with `.env.local`). Commit
      `feat(card): the industry popovers read company, period and link from the CV feed`.

### Task 4: The Ask panel

Follow Task 9 of `docs/superpowers/plans/2026-10-08-new-pages.md` exactly, with three changes: write
the copy marked `"..."` yourself (plain, short, no em dashes; `design:ux-copy`); add
`https://challenges.cloudflare.com` to the CSP's `script-src` and `frame-src` in `public/_headers`;
leave `CLAUDE.md` and `README.md` to Task 7. Commit `feat(ask): the Ask panel on the card`.

### Task 5: Serve the generated PDF (after Tasks 1 and 2)

**Files:**

- Create: `src/app/resume.pdf/route.ts`, `src/lib/resume-file.ts`, `src/lib/resume-file.test.ts`,
  `public/stevan-pavlovic.jpeg` (from `public/portraits/portrait-800.webp` with `sips`)
- Modify: `src/lib/resume-facts.ts`, `NOTICE`
- Delete: `public/resume.pdf`

**Interfaces:**

- Produces: `export const photoPath = (pictureUrl: string, siteOrigin: string): string | null`
  (`public/<path>` when the URL is on the site's own origin, else `null`); `export const
getResumePdf = (): Promise<Uint8Array>` (once per process: `getCv()`, the photo from `public/` or
  none, `renderResumePdf`). `getResumeFacts()` reads `getResumePdf()`; its error says "resume PDF".

- [x] **Step 1:** Tests: `photoPath` for the site's own URL, another host, a bad URL;
      `getResumeFacts` on a rendered sample gives `pages >= 1`.
- [x] **Step 2:** FAIL → implement → PASS. The route: `dynamic = "force-static"`, `GET` returns the
      bytes with `Content-Type: application/pdf`. If Next's bundler breaks react-pdf, add it to
      `serverExternalPackages` in `next.config.ts`.
- [x] **Step 3:** `pnpm build && head -c 4 dist/resume.pdf` → `%PDF`. Commit
      `feat(pdf): build resume.pdf from the CV feed`.

### Task 6: The contract fixture and the MCP facts (after jobsearch Task 3)

**Files:**

- Create: `src/lib/cv-feed.fixture.json` (byte copy of jobsearch `fixtures/cv-feed.json`),
  `src/lib/cv-contract.test.ts`
- Modify: `worker/facts.ts`, `worker/facts.test.ts`

- [x] Tests: `the hirista fixture parses with cvSchema and keeps every field` (deep-equal after
      `stripPrivate`); `facts read projects from /cv.json`. FAIL → implement → PASS → commit
      `test(cv): the hirista feed fixture as a contract`.

### Task 7: Docs (after Tasks 1 to 6)

- `CLAUDE.md`: the build pipeline (fetch, fallback, guard, `.cv/`), `/resume.pdf` built from the
  feed (no committed PDF; the "No file in public/ is generated" sentence stays true), `.env.local`,
  the Ask panel, `workers_dev` off, and a pointer to jobsearch `DEPLOYMENT.md` "Integration
  contract" with the secrets matrix; fix line 76 ("once the CV feed lands").
- `README.md` Getting started: `CV_FEED_URL`, `CV_FEED_TOKEN`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
- `docs/superpowers/specs/2026-10-08-new-pages-spec.md` (31, 34, 52, 66) and the plan (53-56,
  146-180, the `force-cache` line): mark superseded inline.
- Commit `docs: the hirista integration`.

## Settings (owner yes, one batch)

Cloudflare: Turnstile widget for `stevanpavlovic.com` (owner); website Worker secret
`TURNSTILE_SECRET_KEY`; Workers Builds variable `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; read back the
build command (must be `pnpm run build`), the deploy command, the variable names and the deploy hook;
Zero Trust Access apps on hirista.app. GitHub `pavstev/website`: secret scanning, push protection,
Dependabot alerts and security updates on. Local: owner writes `~/work/website/.env.local`.

## Verification (Phase 5, scripts written ahead)

No-token 404, token 200 and schema-valid, the hook after a save, popovers (`website-card-e2e.mjs`,
26 checks), axe at 1440 and 390 px, `/llms.txt`, `/mcp` `tools/list`, `/api/ask`, `/resume.pdf`,
CI and both Workers Builds green.
