# Decision record: new pages for stevanpavlovic.com

Date: 2026-10-08. Status: agreed in interview; the CV feed, the Worker, `/mcp` and the Ask panel are built. The other pages are not. Plan: `docs/superpowers/plans/2026-10-08-new-pages.md`. Lines marked superseded were replaced by `docs/superpowers/plans/2026-10-08-hirista-integration.md`.

> **Removed 2026-10-08 by the owner's decision:** the Ask panel, `/api/ask`, the Turnstile check and the Workers AI binding (decisions 2, 5 and 7 and the entries below about them). The Worker keeps `/mcp` only. What the removed parts said is kept here as history.

## Goal

Add a small set of mostly automatic pages and one AI endpoint so more people find the site and more of them want to hire Stevan, without a writing habit.

## Decisions

1. **Pages: /sapat, /cronfluent, /lab, /colophon, /now, plus /api/ask and /mcp.** _Removed 2026-10-08: /api/ask._
   Reason: the user's picks. Rejected: /cv page, /tools with cronfluent, /activity, hire-me block, timeline, micro tools, changelog, /uses, explainer.

2. **Ask-me AI has two routes on one Worker: /api/ask for humans and /mcp for agents.** _Removed 2026-10-08: /api/ask; /mcp stays._
   Reason: both ticked. Rejected: chat only, MCP only.

3. **CV facts come from the jobsearch app through a secure endpoint, fetched at build time.**
   The data is in the cvexp schema (`ResumeData`, public npm package `cvexp` 2.1.0). The build fails on any non-200, like the GitHub calls today. _Superseded: a timeout, a network error or a 5xx now falls back to the live `/cv.json`; a 404, a redirect, a missing variable or invalid data still fails the build._ Reason: one source of truth, no private GitHub read, no hand copying. Rejected: a jobsearch Action that pushes the JSON into the website repo (recommended, declined); copy by hand.

4. **Strip only the phone number.** The current employer appears everywhere: page data, AI answers, MCP. Reason: the user dropped the old rule on 2026-10-08. The memory note was updated.

5. **Cloudflare plan: Workers Free. Guard: Turnstile plus a per-IP rate limiter. Nothing stored.** _Removed 2026-10-08: Turnstile; the per-IP rate limiter stays on /mcp._
   Reason: the free plan stops at 10,000 neurons a day, so the bill cannot grow. Rejected: paid plan with a KV daily cap; rate limit only.

6. **Home navigation: a quiet link row under the repo strip** (Projects, Lab, Now, Colophon). Reason: always visible, crawlable, 24 px. Rejected: a "More" popover; a header bar.

7. _Removed 2026-10-08:_ **Chat for humans: an "Ask" button on the card that opens a popover panel**, like the Vienna panel. Reason: the card stays one screen. Rejected: a /ask page; an inline input.

## Defaults and assumptions (decided without you)

- **Endpoint contract (jobsearch side, see Appendix A):** `GET {CV_FEED_URL}/api/public/cv`, with `CV_FEED_URL` set to `https://hirista.app` ~~and `/api/public/cv.pdf`~~. Bearer secret in the `Authorization` header, constant-time compare. Returns the owner's generic résumé as cvexp `ResumeData` plus `updatedAt`, phone removed server-side. ~~A Cloudflare Access bypass policy covers only these two paths.~~ Rate limited with the existing limiter. _Superseded: the feed host is hirista.app (the old jobsearch host only answers a 308), there is no `cv.pdf` route and no Access bypass._
- **Secrets:** website build variables `CV_FEED_URL` and `CV_FEED_TOKEN` on Cloudflare; locally in `.env.local` (gitignored). Missing values fail the build with a clear message. jobsearch Worker secrets: `CV_FEED_TOKEN`, `CV_FEED_OWNER_ID`, `WEBSITE_DEPLOY_HOOK_URL`.
- **Freshness:** when the résumé is saved in jobsearch, it POSTs the website's Workers Builds deploy hook, so the site rebuilds within minutes.
- **The PDF:** `public/resume.pdf` is no longer committed. ~~The build downloads `/api/public/cv.pdf` (made by cvexp with Browser Rendering in jobsearch) into `dist/resume.pdf`.~~ The download name stays `Stevan_Pavlovic_Resume.pdf`. _Superseded: the website build renders `dist/resume.pdf` itself from the feed JSON with `@react-pdf/renderer` (`src/lib/resume-pdf.ts`, `src/lib/resume-file.ts`)._
- **Validation:** the website validates the JSON with ~~the `cvexp` zod schema (new dependency)~~ and again strips `basics.phone` defensively. _Superseded: `cvSchema` in `src/lib/cv.ts` mirrors cvexp's shape and adds `projects`; there is no `cvexp` dependency._
- **Worker layout:** `wrangler.jsonc` gets `main` and `run_worker_first: ["/api/*", "/mcp", "/mcp/*"]`. All other paths stay free static assets. The Worker code lives in `worker/` and never reaches the Next.js bundle. _Changed 2026-10-08 by the owner's decision: `run_worker_first` is now `["/mcp", "/mcp/*"]`._
- **/api/ask:** POST, JSON body `{ question, turnstileToken }`, 500-character question cap, Turnstile verified server-side, per-IP limiter (Workers Rate Limiting binding, about 20 a minute), Workers AI with a current small instruct model from the catalog, system prompt built from the same CV JSON and the repo list at build time, answers only from the facts, says "I do not know" otherwise, no memory, no logs of question text. Replies stream as text. _Removed 2026-10-08 by the owner's decision._
- **/mcp:** authless Streamable HTTP, stateless, official `@modelcontextprotocol/sdk`. Tools: `profile`, `experience`, `skills`, `projects`, `contact`. Same rate limiter. Listed in llms.txt. _The rate limiter binding is now named `MCP_LIMITER`._
- **Chat panel:** `popover="auto"`, `holdScene` while open, Turnstile widget inside the panel only, a one-line note "Answers come from an AI reading my CV. Nothing is stored." _Removed 2026-10-08 by the owner's decision._
- **CSP:** add `challenges.cloudflare.com` to `script-src` and `frame-src`, `'self'` already covers `/api/ask`. Non-HTML rules stay as they are. _Removed 2026-10-08 by the owner's decision; the CSP is back to its earlier form._
- **Privacy note:** one new line: "The Ask panel sends your question to Cloudflare's AI model and keeps nothing." _Removed 2026-10-08 by the owner's decision._
- **Project pages (/sapat, /cronfluent):** one page per repo that `getRepos` already picks, except `website` keeps no page (its README is the repo's own). Built from the README (GitHub markdown API, GFM) and the releases list. HTML is sanitized at build with an allowlist (no scripts, no inline handlers, no iframes), images rewritten to `raw.githubusercontent.com`. Šapat shows the latest release with its download link and SHA-256. JSON-LD `SoftwareApplication` (sapat) and `SoftwareSourceCode` (cronfluent). Added to the sitemap and llms.txt.
- **/lab:** one page, one effect at a time (sky, clouds, planets, globe, name tear), a switcher, a source link per effect, the same reduced-motion and software-renderer rules as the card. Title and description for galleries. `noindex` is off.
- **/colophon:** generated from `package.json` (framework, libraries, versions), the build date, the repo link and the checks list. Hand-written intro of three sentences in `i18n.ts`. No scores (they need a stored measurement).
- **/now:** `src/content/now.md` with a date in front matter. Rendered at build. A stale note after 120 days ("last updated N months ago"). You write it; I set the first one up as a template.
- **Navigation and SEO:** link row in `i18n.ts`, every new page in `sitemap.ts` and llms.txt, Open Graph image reused, `ProfilePage` stays on `/`.
- **Docs:** `CLAUDE.md` loses "never add a second page" and gains the page list, the Worker, the endpoint contract and the secrets.
- **Checks:** `pnpm check` still passes with no tracked file changed; the Worker gets its own `tsc` include and a few `node --test` files for the prompt builder and the sanitizer.

## Accepted risks (your call over my advice)

- **Build-time fetch from jobsearch.** Every website build depends on the feed being up and the secret being valid. If either fails, the site does not deploy until fixed. The recommended push-from-jobsearch path avoided this. _Superseded: a feed that is down no longer stops the build (it falls back to the live `/cv.json`); only a wrong token, a redirect, a missing variable or invalid data does._
- **cronfluent stays on its subdomain.** The one idea with measured search demand (about 1300 US searches a month) is not on the main domain.
- **No CV page.** The AI and the MCP know the full history, but no human-readable page shows it. Recruiters still get the PDF.

## Out of scope

- /cv page, /tools, /activity, hire-me block, career timeline, micro tools, changelog with feeds, /uses, the backend explainer.
- Any change inside jobsearch beyond Appendix A (the prompt is the deliverable; the work happens in that repo).
- Gallery and directory submissions are listed in Appendix B as your tasks.

## Appendix A: prompt for the jobsearch repo

Paste this into a session in `pavstev/jobsearch`:

> _Superseded: the feed has one route, `GET /api/public/cv`; the PDF is rendered by the website build, so there is no `cv.pdf` route, no Browser Rendering binding and no Access bypass policy. The prompt below is the original._
>
> Add a read-only public CV feed for the website build. Two routes in the existing API handler: `GET /api/public/cv` returns the owner's generic résumé as cvexp `ResumeData` JSON plus `updatedAt` (ISO), with `basics.phone` set to an empty string; `GET /api/public/cv.pdf` returns the same résumé rendered by `cvexp` `generate` with `@cloudflare/puppeteer` (Browser Rendering binding `BROWSER`) as `application/pdf`, cached for one hour in the Cache API. Both require `Authorization: Bearer <CV_FEED_TOKEN>`; compare with `crypto.subtle.timingSafeEqual`; any other request gets 404, never 401, so the routes stay invisible. The owner is `CV_FEED_OWNER_ID` (a Worker secret); read the résumé with the existing `asOwner` path, never bypass RLS. Apply the existing `API_LIMITER`. Add a Cloudflare Access bypass policy for exactly these two paths (document the dashboard steps in DEPLOYMENT.md). When the résumé is saved, POST `WEBSITE_DEPLOY_HOOK_URL` once (ignore failures, log them). Add `check:db` cases for: wrong token is 404, right token returns the schema-valid JSON with an empty phone, PDF route returns `%PDF` bytes. Document the three secrets and the contract in CLAUDE.md. Do not log the token or the résumé.

## Appendix B: distribution checklist (your tasks, after launch)

- Submit /lab to Godly and `mesh3d.gallery` (free). SiteInspire if they take entries. CSS Winner is 9 USD if you want a badge.
- Set a Bluesky domain handle: a DNS TXT record `_atproto` with your DID.
- List /now on `nownownow.com`.
- Post in the next "Ask HN: Share your personal website" thread.
- Add `rel="me"` from the site to Bluesky and back.
