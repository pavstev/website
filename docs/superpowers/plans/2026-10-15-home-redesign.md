# Home redesign plan (2026-10-15)

Owner decisions from a ps:askme round. The sky (`space-background`, shaders, the sun glide) does not change.

## Decisions

1. `/work`: one page with two sections, "Open source projects" (`#projects`) and "Products" (`#products`), blog-style row cards. CSS planets on repo rows (the existing `.repo-planet` fallback), the product marks on product rows. No WebGL on the page. The home drawers are deleted.
2. `/about`: one page, short themed parts (h2 per theme), about 450 words, ends with "what I care about" and a "write me" line with the email. Text lives in `content/about/index.mdx`, rendered with the blog prose styles. No date, no tags, no share image work beyond the site default.
3. Home card buttons under the contact keys: About, Work, Blog (one `.section-row`, same keycap look as today). Old `/#projects` and `/#products` links just open the home page.
4. Top bar on Blog, Work and About pages: the crumbs on the left ("Stevan Pavlović / Work"), and three links About, Work, Blog on the right (in the old `[data-bar-slot]`), the current one with `aria-current="page"`.
5. Pause button: deleted on every page (`motion-toggle.tsx`, `ui/icon-morph.tsx`, its CSS, its tip copy, the bar slot use). The pause state stays (`motion-pause.ts`, `data-motion-paused`, `useStill()`, `stillQuery()`, the paused CSS twins): a small "Stop motion" / "Start motion" text button in every footer (home card footer and the blog/work/about footer) toggles it. It keeps WCAG 2.2.2. Hidden without JS and under OS reduced motion, like the old button.
6. Title everywhere: "Software Engineer · Tech Lead" (`personalData.title`, JSON-LD `jobTitle`, GitHub profile, LinkedIn sync). The owner changes the hirista headline.
7. "AI-powered engineer" only in the bio and on About.
8. Home bio (all five tap words stay, `splitBio` must still find them): "Hi, I’m Stevan. I have been a software engineer for more than eleven years, across many stacks and teams. Since 2024 I have worked as an AI-powered engineer, and I ship faster than ever. My work runs in fintech, betting, healthtech and fleet logistics. I live in Vienna."
9. Vienna leaves the blog descriptions and the blog side line. It stays in the meta description, JSON-LD and the bio. Meta and share text say "software engineer".
10. `/about` and `/work` use the blog's sky mode: the home to page sun glide plays the same way as for `/blog`. They go into the sitemap and `llms.txt`.

## Parts

- **A, chrome** (helper, own worktree): decision 4 (top bar links) and 5 (pause purge, footer toggle). Owns `blog-header.astro`, `site-footer.tsx`, the new footer toggle, `motion-toggle.tsx`, `ui/icon-morph.tsx`, the motion CSS in `globals.css`/`blog.css`/`card.css`, `en.motion` and a new `en.nav` in `i18n.ts`, `.claude/rules/motion.md`, the Pause bullet in `docs/architecture.md`. The bar links point at `/about`, `/work`, `/blog` even before those pages exist.
- **B, pages** (helper, own worktree): decisions 1, 2 (route and rendering, with a placeholder body), 3 and 10. Owns `card-sections.astro`, `card-drawer.tsx`, `repo-strip.tsx`, `product-strip.tsx`, `repo-planets-canvas.tsx` and the planet WebGL code if it becomes dead, the new `src/pages/work.astro` and `src/pages/about.astro`, `content/about/index.mdx`, `sky-tween.ts` / `blog/slug.ts` route checks, `blog/crumbs.ts`, sitemap, `llms.txt`, `structured-data.ts` (add `/work` and `/about` only if it fits the existing graph), drawer and tile CSS, `en.card` / new `en.work` / `en.about` keys, `.claude/rules/card.md`, matching `docs/architecture.md` bullets. Keep `ui/drawer.tsx` (the blog TOC drawer uses it).
- **C, copy** (lead): decisions 6 to 9, plus the About text.

## Rules for every part

Repo rules in `CLAUDE.md` hold: no comments, no `any`, no `!`, no eslint-disable, UI strings in `src/lib/i18n.ts`, Tailwind paren syntax, no hex outside `globals.css`/`theme.ts`, knip-clean (delete dead files, exports and tests). Interior.dev look: reuse the existing `.keycap-host`, `.mat-row`, `.mat-pop` materials and tokens. No inline styles for new UI. `pnpm check` must pass before the commit (the pre-commit hook runs it). One commit per part, Conventional Commits, no co-author line. Never push. Never deploy.

## Progress

- [ ] A chrome
- [ ] B pages
- [ ] C copy and About text
- [ ] merge A, B, C on main, `pnpm check`, final review, show the About text to the owner before push
