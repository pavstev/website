# Agent map: website

<!-- For the main thread, before it spawns a helper here. Under 60 lines. Shared side: the dotfiles repo's `claude/HARNESS-MAP.md` -->

## Jobs

| Job                                 | Dispatch, in order                                          | Check                                       |
| ----------------------------------- | ----------------------------------------------------------- | ------------------------------------------- |
| A page or component change          | `worker` (or the main thread for a small edit)              | `pnpm check:fast`                           |
| A visual change                     | the change above -> `ui-verifier` with the pages and widths | pass or fail with evidence                  |
| A pointer flow (click, drag, hover) | `ui-verifier` in headless Playwright, never the Chrome tab  | pass or fail with evidence                  |
| A release or a big page change      | `site-auditor`                                              | `pnpm audit:site`                           |
| A push to `main`                    | `live-checker`                                              | live `sha` in the build.json marker, CI run |
| The final review                    | `code-reviewer`                                             | the diff                                    |

## Agents here

| Agent          | Job and trigger                                                                      | Tools                         | Model  | Owns               |
| -------------- | ------------------------------------------------------------------------------------ | ----------------------------- | ------ | ------------------ |
| `site-auditor` | runs `pnpm audit:site`, hands back each failure with file:line; before a release     | Read, Bash, Grep, Glob, Write | sonnet | scratch notes only |
| `live-checker` | after a push: live sha vs pushed sha, then the CI run; verdict PASS, FAIL or NOT YET | Read, Bash                    | haiku  | none               |

Shared helpers used here: `ui-verifier`, `code-reviewer`, `worker`.

## Skills, rules and hooks

- Rules: `.claude/rules/` has 6 files (blog, card, motion, sky-story, sky, story). They load by `paths:` when you touch a matching file.
- Hooks: husky pre-commit runs `pnpm check:fast --staged`. Husky pre-push runs the full `pnpm check`.

## Rules

- Never deploy. Every push to `main` deploys on Cloudflare. Nobody runs `wrangler deploy` or `pnpm deploy`.
- `live-checker` makes one try and answers NOT YET when the sha is old. The main thread owns the wait.
- A heavy audit runs once at the end, in the background, through `site-auditor`.
- The Claude in Chrome tab is hidden and ignores clicks: pointer flows go to headless Playwright.
- For your own browser runs open `http://localhost:4321`, not `127.0.0.1`.
- `site-auditor` may start the local `wrangler dev` server that `pnpm audit:site` starts. No agent runs any other wrangler command.
- The owner has no iPhone: emulate WebKit, never ask for a real-iPhone check.
