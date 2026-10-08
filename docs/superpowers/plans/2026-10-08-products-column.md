# Products Column, Logo Planets and Pause Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "2 products" column (hirista, Safety Real Time) beside the open-source repos, with WebGL logo planets, and a page-wide pause-motion button.

**Architecture:** One `.card-strips` wrapper holds the repo strip, the new product strip and the existing planets canvas, so one WebGL context draws repo planets and logo planets. A pause flag on `<html>` (set before paint by an inline head script) folds into the existing scene hold for canvases and into a `stillQuery()` for DOM loops. Product data is hand-written and feeds the tiles, JSON-LD, `llms.txt`, the MCP `products` tool and the profile README.

**Tech Stack:** Next.js 16 static export, React 19, Tailwind v4, three.js r186, TypeScript strict, `node --test`, Cloudflare Worker (`/mcp`).

**Spec:** `docs/superpowers/specs/2026-10-08-products-column-design.md`

## Global Constraints

- Work in a git worktree on branch `feat/products-column` (other sessions rewrite `main`). Copy `.env.local` into the worktree root before the first commit (it holds `CV_FEED_URL` and `CV_FEED_TOKEN`; the pre-commit hook runs `pnpm check`, which builds). Never commit `.env.local`. Never push, never deploy.
- Every commit runs `pnpm check` through husky; it must pass. Conventional Commits. No co-author or "Generated with" lines.
- No comments, JSDoc, TODO/FIXME in source. No `eslint-disable`. No `any`, no `!` non-null assertions. Explicit return types on exports, `import { type Foo }`, kebab-case files, one component per file.
- All UI strings in `src/lib/i18n.ts`. No em dashes, no taglines. The site spells "résumé".
- Hex colours only in `src/styles/globals.css` or `src/lib/theme.ts`. Tailwind v4 paren syntax (`bg-(--surface)`).
- Modules loaded by `node --test` (and everything they import) use relative `./x.ts` imports; `node --test` has no `@/` alias.
- Exact copy: hirista, `https://hirista.app`, role "Solo founder", period "2026", line "Scores your saved jobs and writes the résumé for each."; Safety Real Time, `https://safetyrealtime.com`, role "Co-founder & CTO", period "since 2022", line "Fleet software for trucking: pre-trip checks, live dashboards."; heading template "{count} products" / "{count} product".
- Colours: hirista disc `#1c1410`, mark `#efebe2`, accent `#f79900`, tint `#f79900`; Safety Real Time disc `#32d74b`, mark `#1f232c`, accent `#1f232c`, tint `#32d74b`.
- Layout: two columns from `64em`; `--container-page-max: 68rem` there; no-scroll gate `(min-width: 64em) and (min-height: 45em), (min-width: 48em) and (min-height: 75em)` in block-form `@custom-variant no-scroll`.
- Logo motion: sunrise spin `-1.9` rad to `0`, ease-out cubic, `2400` ms, starts at 60% visibility; wobble amplitude `0.35` rad, period `9000` ms; hover speed x`3.4`, amplitude at most `0.5` rad; hold/pause/freeze/reduced motion snap to spin `0`.
- Pause: storage key `motion-paused` (value `"1"`), attribute `data-motion-paused`, event `motion:pause`; `scene:hold` is also dispatched on every change.
- One WebGL context for all planets; `renderer.compileAsync` before the first frame; `checkShaderErrors` only outside production.

## Review Focus

- Storage blocked or throwing (Safari private mode, disabled site data): the head script must not throw, the button must still pause for the session. Pinned in Task 2 (`node:vm` with a throwing `localStorage`) and Task 1 (`setMotionPaused` with throwing storage).
- Pause, then open and close the Vienna globe: the page must stay paused (the globe calls `holdScene(false)` on close). Pinned in Task 1 (`isSceneHeld` truth table) and checked in Task 15.
- OS reduced motion switched at runtime, paused or not: DOM loops follow `stillQuery()` `change` events, the button hides under OS reduced motion and returns after. Pinned in Task 1 (`stillQuery` events) and Task 6 (toggle visibility rule).
- Pause, scene hold, a frame-pacer freeze or reduced motion in the middle of the sunrise: the logo snaps to the rest pose and never sticks on the night side. A hidden tab or an off-screen stage resumes and finishes the sunrise when visible again. On WebGL context loss the flat marks return. Pinned in Task 13 (`settleLogoMotion`) and Task 14 (browser checks `pause snaps`, `context loss`), rechecked in Task 15.
- 320 px phones and 200% zoom: role line and product line wrap inside the tile, no horizontal overflow, the dock stays after `main`. Checked in Task 12 and Task 15.

---

## File map

New:

- `src/lib/motion-pause.ts` (+ `motion-pause.test.ts`): pause state, storage, events, head script, `stillQuery()`.
- `src/lib/products.ts` (+ `products.test.ts`): product list and `llms.txt` lines.
- `src/lib/product-marks.ts`: mark path data.
- `src/lib/logo-motion.ts` (+ `logo-motion.test.ts`): pure spin math.
- `src/lib/logo-planet.ts`: mask texture and logo planet material.
- `src/lib/frame-clock.ts` (+ `frame-clock.test.ts`): accumulated animation clock for the sky and clouds.
- `src/lib/structured-data.test.ts`.
- `src/components/card-strips.tsx`, `product-strip.tsx`, `product-mark.tsx`, `motion-toggle.tsx`, `page-dock.tsx`.

Changed:

- `src/lib/scene-hold.ts`, `src/app/layout.tsx`, `src/lib/privacy-ack.ts` (if its script moves), `src/components/privacy-note.tsx`, `src/components/privacy-ack.tsx` (if it sets the attribute), `src/app/page.tsx`.
- DOM loops: `src/lib/name-glitch.ts`, `cursor.ts`, `contact-links.ts`, `pill-aurora.ts`, `download-ring.ts`, `intro.ts`, `portrait-effects.ts`, `portrait-expand.ts`, `scroll-motion.ts`, `city-globe.ts`.
- Canvases: `src/components/space-background.tsx`, `src/lib/clouds.ts` (accumulated clock), `src/lib/repo-planets.ts` (logo planets, `data-planets` on the stage, view vector).
- `src/components/repo-strip.tsx`, `src/styles/globals.css`, `src/lib/theme.ts`, `src/lib/i18n.ts`, `src/lib/icon-data.ts` (via `pnpm icons`).
- `src/lib/structured-data.ts`, `src/app/llms.txt/route.ts`, `src/lib/cv-llms.ts` (+ test), `worker/mcp.ts` (+ test), `src/profile/types.ts`, `readme.ts`, `cli.ts`, `fixtures.ts`, `render.test.ts`.
- `CLAUDE.md`.

## Tasks

1. Pause state core: `scene-hold.ts` + `motion-pause.ts`.
2. Head script before paint (`layout.tsx`, privacy-ack migration).
3. DOM loops follow `stillQuery()`.
4. Sky and clouds keep an accumulated clock.
5. CSS `still` variant and paused twins.
6. Pause button and page dock.
7. Product data: `theme.ts`, `i18n.ts`, `products.ts`, `product-marks.ts`.
8. JSON-LD products.
9. `llms.txt` Products section and résumé dedupe.
10. MCP `products` tool.
11. Profile README products section.
12. Card strips, product tiles and layout E.
13. Logo motion math.
14. Logo planets in the planets canvas.
15. Docs and full verification.

### Notes from the writers of Tasks 1 to 6

All six tasks were dry-run in a scratch copy of `51dbaf0`. The test code below passes, and `tsc`, ESLint (zero warnings), Prettier after `pnpm fix` and knip pass at every task boundary. Builds were not run there, because they need `.env.local`. All line numbers refer to `51dbaf0`.

1. `createFrameClock`: besides the 100 ms cap, `tick` floors each step at 0. A rAF timestamp can be earlier than an earlier `performance.now()`, and the clock must never run backwards. Besides the stop functions, every draw made while a loop is stopped calls `pause()` right before it: the sky's resize and settled-scroll frames, and the clouds' `drawStill`. The clouds redraw on every scroll so they keep tracking the card. Without that `pause()`, each scroll frame on a paused page would add up to 100 ms and the clouds would drift.
2. `subscribeMotionPause`: the `storage` handler is a module-level function, because `unicorn/consistent-function-scoping` rejects it inside. All subscribers therefore share one listener, and the page has exactly one subscriber (the toggle).
3. `MotionToggle` wraps the button and the tip in `span.motion-item`, as `.contact-item` does: it is the hover root, holds `data-dismissed` and is the dock's flex item. The no-JS and OS-reduced-motion hide rules target `.motion-item` instead of `.motion-toggle`, so a hidden toggle leaves no empty flex item and no gap. `.motion-item` is not positioned, so the tip centres above the dock and stays on screen at 320 px and at 400% zoom. A tip centred on the button would overflow the left edge below about 500 px.
4. `aria-describedby` points at the visible tip line (`motion-tip-pause` or `motion-tip-play`, picked from `paused`) instead of at `#motion-tip`. When the tip is hidden, Chromium reads every descendant of the element `aria-describedby` points to, `display: none` ones included, so pointing at the whole tip would read both lines. `#motion-tip` keeps `role="tooltip"`.

### Task 1: Pause state core

**Files:**

- Create: `src/lib/motion-pause.ts`
- Modify: `src/lib/scene-hold.ts:1-6`
- Test: `src/lib/motion-pause.test.ts`

**Interfaces:**

- Consumes: `reducedMotionQuery` (`src/lib/media.ts`), `sceneHoldEvent`, `holdScene` (unchanged).
- Produces: `motionPausedAttribute = "data-motion-paused"` and `isSceneHeld(): boolean` (held OR paused) in `scene-hold.ts`. `motionPauseKey = "motion-paused"`, `motionPauseEvent = "motion:pause"`, `isMotionPaused(): boolean`, `setMotionPaused(paused: boolean): void`, `subscribeMotionPause(callback: () => void): () => void`, `interface StillQuery`, `stillQuery(): StillQuery` in `motion-pause.ts`.

- [ ] **Step 1: Write the failing test** `src/lib/motion-pause.test.ts` (`pnpm fix` reflows the one-line bodies):

```ts
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { reducedMotionQuery } from "./media.ts";
import {
  isMotionPaused,
  motionPauseEvent,
  motionPauseKey,
  setMotionPaused,
  type StillQuery,
  stillQuery,
  subscribeMotionPause,
} from "./motion-pause.ts";
import { holdScene, isSceneHeld, sceneHoldEvent } from "./scene-hold.ts";

const stubs = [
  "addEventListener",
  "dispatchEvent",
  "document",
  "localStorage",
  "matchMedia",
  "removeEventListener",
];

const blocked = (): never => {
  throw new Error("storage blocked");
};

const fakeRoot = (attributes: Set<string>): object => ({
  hasAttribute: (name: string): boolean => attributes.has(name),
  setAttribute: (name: string): void => {
    attributes.add(name);
  },
  toggleAttribute: (name: string, force: boolean): boolean => {
    if (force) attributes.add(name);
    else attributes.delete(name);
    return force;
  },
});

const install = (storageWorks = true) => {
  const attributes = new Set<string>();
  const events: string[] = [];
  const media = Object.assign(new EventTarget(), { matches: false });
  const storage = new Map<string, string>();
  const target = new EventTarget();
  for (const type of [sceneHoldEvent, motionPauseEvent])
    target.addEventListener(type, () => {
      events.push(type);
    });
  const write = (change: () => void): void => {
    if (!storageWorks) blocked();
    change();
  };
  Object.assign(globalThis, {
    addEventListener: target.addEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
    document: { documentElement: fakeRoot(attributes) },
    localStorage: {
      removeItem: (key: string): void => {
        write(() => storage.delete(key));
      },
      setItem: (key: string, value: string): void => {
        write(() => storage.set(key, value));
      },
    },
    matchMedia: (query: string): typeof media => {
      assert.equal(query, reducedMotionQuery);
      return media;
    },
    removeEventListener: target.removeEventListener.bind(target),
  });
  return { attributes, events, media, storage };
};

const storageEvent = (key: string, newValue: null | string): Event =>
  Object.assign(new Event("storage"), { key, newValue });

afterEach(() => {
  for (const name of stubs) Reflect.deleteProperty(globalThis, name);
});

describe("motion pause", () => {
  it("sets the attribute, stores the choice and announces hold then pause", () => {
    const fake = install();
    setMotionPaused(true);
    assert.deepEqual(
      [isMotionPaused(), [...fake.attributes], [...fake.storage]],
      [true, ["data-motion-paused"], [["motion-paused", "1"]]]
    );
    assert.deepEqual(fake.events, ["scene:hold", "motion:pause"]);
    setMotionPaused(false);
    assert.deepEqual(
      [isMotionPaused(), fake.storage.size, fake.events.length],
      [false, 0, 4]
    );
  });

  it("pauses for the session when storage throws", () => {
    const fake = install(false);
    setMotionPaused(true);
    assert.equal(isMotionPaused(), true);
    assert.deepEqual(fake.events, ["scene:hold", "motion:pause"]);
  });

  it("holds the scene while held or paused, so closing the globe keeps a pause", () => {
    install();
    holdScene(true);
    setMotionPaused(true);
    holdScene(false);
    assert.equal(isSceneHeld(), true);
    setMotionPaused(false);
    assert.equal(isSceneHeld(), false);
    holdScene(true);
    assert.equal(isSceneHeld(), true);
  });

  it("follows other tabs through storage events until unsubscribed", () => {
    const fake = install();
    let calls = 0;
    const unsubscribe = subscribeMotionPause(() => {
      calls += 1;
    });
    globalThis.dispatchEvent(storageEvent("privacy-ack", "1"));
    assert.equal(calls, 0);
    globalThis.dispatchEvent(storageEvent(motionPauseKey, "1"));
    assert.equal(isMotionPaused(), true);
    assert.deepEqual(fake.events, ["scene:hold", "motion:pause"]);
    globalThis.dispatchEvent(storageEvent(motionPauseKey, null));
    assert.equal(isMotionPaused(), false);
    setMotionPaused(true);
    assert.equal(calls, 3);
    unsubscribe();
    setMotionPaused(false);
    globalThis.dispatchEvent(storageEvent(motionPauseKey, "1"));
    assert.equal(calls, 3);
    assert.equal(isMotionPaused(), false);
  });

  it("stillQuery matches reduced motion or a pause and reports both changes", () => {
    const fake = install();
    const query: StillQuery = stillQuery();
    let changes = 0;
    const onChange = (): void => {
      changes += 1;
    };
    query.addEventListener("change", onChange);
    assert.equal(query.matches, false);
    setMotionPaused(true);
    assert.equal(query.matches, true);
    fake.media.matches = true;
    fake.media.dispatchEvent(new Event("change"));
    setMotionPaused(false);
    assert.equal(query.matches, true);
    fake.media.matches = false;
    assert.equal(query.matches, false);
    assert.equal(changes, 3);
    query.removeEventListener("change", onChange);
    setMotionPaused(true);
    fake.media.dispatchEvent(new Event("change"));
    assert.equal(changes, 3);
  });
});
```

- [ ] **Step 2: Run it to verify it fails.** `node --test src/lib/motion-pause.test.ts` fails with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/src/lib/motion-pause.ts'`.
- [ ] **Step 3: Implement the module.**
  - In `scene-hold.ts`, add `export const motionPausedAttribute = "data-motion-paused";` after line 1. In lines 5-6, `isSceneHeld` returns `root.hasAttribute(attribute) || root.hasAttribute(motionPausedAttribute)` with `const root = document.documentElement`. `holdScene` stays unchanged.
  - `src/lib/motion-pause.ts` imports only `./media.ts` and `./scene-hold.ts`, with relative `.ts` paths. It touches no DOM at import time, because Task 2 imports it into the server layout.
  - `setMotionPaused` runs `toggleAttribute(motionPausedAttribute, paused)`. Then, inside one `try { … } catch {}`, it calls `globalThis.localStorage.setItem(motionPauseKey, "1")` or `removeItem(motionPauseKey)`. The empty catch follows `cv.ts:214`. Last, it dispatches `new Event(sceneHoldEvent)` and then `new Event(motionPauseEvent)` on `globalThis`.
  - A module-level `onStorage(event: StorageEvent)` ignores every key except `motionPauseKey`, runs `toggleAttribute(motionPausedAttribute, Boolean(event.newValue))` and dispatches both events. `subscribeMotionPause` adds and removes `callback` on `motionPauseEvent` and `onStorage` on `"storage"`.
  - `stillQuery()` creates one `globalThis.matchMedia(reducedMotionQuery)`. Its `matches` getter returns `media.matches || isMotionPaused()`. Its `addEventListener` and `removeEventListener` register the listener on the media query `change` and on `globalThis` for `motionPauseEvent`.
- [ ] **Step 4: Run it to verify it passes.** `node --test src/lib/motion-pause.test.ts` reports `ℹ tests 5`, `ℹ pass 5`, `ℹ fail 0`. Then `pnpm exec tsc --noEmit` and `pnpm exec eslint src/lib/scene-hold.ts src/lib/motion-pause.ts src/lib/motion-pause.test.ts --max-warnings=0` both exit 0.
- [ ] **Step 5: Commit.** Run `pnpm fix`, then `git add src/lib/scene-hold.ts src/lib/motion-pause.ts src/lib/motion-pause.test.ts` and `git commit -m "feat(motion): pause state that holds the scene and a still query"`.

### Task 2: Head script before paint

**Files:**

- Modify: `src/lib/motion-pause.ts`, `src/lib/privacy-ack.ts:5`, `src/app/layout.tsx:6,10,69-71,74-76`
- Test: `src/lib/motion-pause.test.ts`

**Interfaces:**

- Consumes: `privacyAckKey`, `privacyAckAttribute` (`./privacy-ack.ts`), `motionPauseKey` and `motionPausedAttribute` (Task 1).
- Produces: `headScript: string`. Before first paint it sets `data-js` on `<html>` (Task 6 gates the toggle on it), plus `data-privacy-ack` and `data-motion-paused` when storage holds them.

- [ ] **Step 1: Write the failing test.** In `motion-pause.test.ts`, add these imports: `import { runInNewContext } from "node:vm";`, `headScript` in the `./motion-pause.ts` list, and `import { privacyAckKey } from "./privacy-ack.ts";`. Then append:

```ts
const runHeadScript = (
  stored: ReadonlyMap<string, string>,
  storageWorks = true
): string[] => {
  const attributes = new Set<string>();
  runInNewContext(headScript, {
    document: { documentElement: fakeRoot(attributes) },
    localStorage: {
      getItem: (key: string): null | string =>
        storageWorks ? (stored.get(key) ?? null) : blocked(),
    },
  });
  return [...attributes];
};

describe("headScript", () => {
  it("marks JS, then the privacy OK and the pause found in storage", () => {
    const both = new Map([
      [motionPauseKey, "1"],
      [privacyAckKey, "1"],
    ]);
    assert.deepEqual(runHeadScript(both), [
      "data-js",
      "data-privacy-ack",
      "data-motion-paused",
    ]);
    assert.deepEqual(runHeadScript(new Map([[motionPauseKey, "1"]])), [
      "data-js",
      "data-motion-paused",
    ]);
    assert.deepEqual(runHeadScript(new Map()), ["data-js"]);
  });

  it("marks JS and does not throw when storage throws", () => {
    assert.deepEqual(runHeadScript(new Map([[motionPauseKey, "1"]]), false), [
      "data-js",
    ]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails.** `node --test src/lib/motion-pause.test.ts` fails with `SyntaxError: The requested module './motion-pause.ts' does not provide an export named 'headScript'`.
- [ ] **Step 3: Implement `headScript` and the layout change.**
  - In `motion-pause.ts`, import `privacyAckAttribute` and `privacyAckKey` from `./privacy-ack.ts`.
  - `headScript` is a template string built from the constants. It starts with `document.documentElement.setAttribute("data-js","")` outside any `try`. One `try{…}catch{}` follows, holding `if(localStorage.getItem("<privacyAckKey>"))document.documentElement.setAttribute("<privacyAckAttribute>","")` and then the same statement for `motionPauseKey` and `motionPausedAttribute`.
  - In `privacy-ack.ts`, delete line 5 (`privacyAckScript`); knip would flag it.
  - In `layout.tsx`, delete line 6 (`import Script from "next/script";`) and line 10 (the `privacyAckScript` import). Insert `import { headScript } from "@/lib/motion-pause";` between lines 8 and 9 (`@/lib/i18n` and `@/lib/personal`). Make `<script dangerouslySetInnerHTML={{ __html: headScript }} />` the first child of `<head>` (lines 69-71) and delete the `<Script id="privacy-ack" …>` block (lines 74-76).
  - Keep `suppressHydrationWarning` on `<html>` (line 68). This is the pattern in `node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md` under "Themes".
- [ ] **Step 4: Run it to verify it passes.** `node --test src/lib/motion-pause.test.ts` reports `ℹ pass 7`, `ℹ fail 0`. `pnpm exec tsc --noEmit` and `pnpm exec eslint src/app/layout.tsx src/lib/motion-pause.ts src/lib/motion-pause.test.ts src/lib/privacy-ack.ts --max-warnings=0` both exit 0.
- [ ] **Step 5: Check the built HTML.** Run `pnpm build`, then:
      `node -e 'for (const f of ["dist/index.html","dist/404.html"]) { const h = require("node:fs").readFileSync(f, "utf8"); const i = h.indexOf("<script>document.documentElement.setAttribute(\"data-js\""); console.log(f, i > 0 && i < h.indexOf("</head>"), h.split("__next_s").length - 1); }'`
      The expected output is `dist/index.html true 0` and `dist/404.html true 0`: the script sits in `<head>` and the old `self.__next_s` push is gone.
- [ ] **Step 6: Check `next dev`.** Start the `dev` configuration in `.claude/launch.json` and open <http://localhost:4321>. The console shows no `Encountered a script tag` error and no hydration error. `document.documentElement.hasAttribute("data-js")` returns `true`. After `localStorage.setItem("privacy-ack", "1")` and a reload, the chip never shows. Then run `localStorage.clear()`.
- [ ] **Step 7: Commit.** Run `pnpm fix`, then `git add src/lib/motion-pause.ts src/lib/motion-pause.test.ts src/lib/privacy-ack.ts src/app/layout.tsx` and `git commit -m "fix(head): set data-js, the privacy OK and the pause before first paint"`.

### Task 3: DOM loops follow `stillQuery()`

**Files:**

- Modify (all in `src/lib/`): `name-glitch.ts`, `cursor.ts`, `contact-links.ts`, `pill-aurora.ts`, `download-ring.ts`, `intro.ts`, `portrait-effects.ts`, `portrait-expand.ts`, `scroll-motion.ts`, `city-globe.ts`

**Interfaces:**

- Consumes: `stillQuery(): StillQuery` and `type StillQuery` (Task 1). `stillQuery()` keeps `.matches` and `addEventListener` / `removeEventListener("change", …)`, so every call site keeps its current shape.
- Produces: no new API. A pause, or OS reduced motion switched at runtime, now stops these effects.

- [ ] **Step 1: Swap the query.** The import line becomes `import { stillQuery } from "@/lib/motion-pause";`. Where `finePointerQuery` is also imported, keep `import { finePointerQuery } from "@/lib/media";` and add the new import below it. Each `const reduce = globalThis.matchMedia(reducedMotionQuery);` becomes `const reduce = stillQuery();`. Existing `change` listeners stay as they are.
  - Import at line 1, query at the listed line: `name-glitch.ts:12`, `contact-links.ts:84` (split import), `pill-aurora.ts:43` (split import), `download-ring.ts:38` and `portrait-expand.ts:40`.
  - `cursor.ts`: line 1 is split, and lines 137 and 163 change. The listeners at lines 151 and 155 stay.
  - `intro.ts`: line 1 import, and line 8 becomes `if (stillQuery().matches) {`.
  - `portrait-effects.ts`: line 1 import, and line 359 changes. The listeners at lines 372 and 375 stay.
  - `scroll-motion.ts`: line 1 becomes `import { type StillQuery, stillQuery } from "@/lib/motion-pause";`. Line 27 becomes `let reduceMotion: StillQuery | undefined;` and line 105 becomes `reduceMotion = stillQuery();`. The listeners at lines 111 and 124 stay.
  - `city-globe.ts`: line 23 becomes the new import, which still sorts between `globe-labels` and `sun`. Line 444 changes. The listeners at lines 884 and 942 stay.
  - Leave the canvases alone: `space-background.tsx:505`, `clouds.ts:245` and `repo-planets.ts:215` keep `matchMedia(reducedMotionQuery)`.
  - Expected side effect: pausing on a scrolled phone page settles `scroll-motion` to 0, as OS reduced motion already does, so the sky and clouds redraw once at progress 0.
- [ ] **Step 2: Verify.**
  - `rg -l "stillQuery\(\)" src --glob '!*.test.ts' | sort` lists exactly the 10 files above.
  - `rg -l reducedMotionQuery src --glob '!*.test.ts' | sort` lists exactly `src/components/space-background.tsx`, `src/lib/clouds.ts`, `src/lib/media.ts`, `src/lib/motion-pause.ts` and `src/lib/repo-planets.ts`.
  - `pnpm exec tsc --noEmit` exits 0, `pnpm exec eslint src/lib/{name-glitch,cursor,contact-links,pill-aurora,download-ring,intro,portrait-effects,portrait-expand,scroll-motion,city-globe}.ts --max-warnings=0` exits 0, and `node --test "src/**/*.test.ts"` reports `fail 0`.
  - The behaviour is checked with the button in Task 6 and in Task 15.
- [ ] **Step 3: Commit.** Run `pnpm fix`, then `git add src/lib/name-glitch.ts src/lib/cursor.ts src/lib/contact-links.ts src/lib/pill-aurora.ts src/lib/download-ring.ts src/lib/intro.ts src/lib/portrait-effects.ts src/lib/portrait-expand.ts src/lib/scroll-motion.ts src/lib/city-globe.ts` and `git commit -m "feat(motion): DOM effects stop while motion is paused"`.

### Task 4: Accumulated clock for sky and clouds

**Files:**

- Create: `src/lib/frame-clock.ts`
- Modify: `src/components/space-background.tsx:5,333,343,370-385,397-401,454,464`, `src/lib/clouds.ts:18,303,388-390,439-444,460-462`
- Test: `src/lib/frame-clock.test.ts`

**Interfaces:**

- Consumes: `isSceneHeld()` (Task 1), already read by both `sync()` functions. The canvases now report `paused` while the page is paused.
- Produces: `interface FrameClock { pause: () => void; tick: (now: number) => number }` and `createFrameClock(startMs?: number): FrameClock`.

- [ ] **Step 1: Write the failing test** `src/lib/frame-clock.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createFrameClock, type FrameClock } from "./frame-clock.ts";

const ticks = (clock: FrameClock, times: readonly number[]): number[] =>
  times.map((now) => clock.tick(now));

describe("createFrameClock", () => {
  it("starts at startMs and adds nothing on the first tick", () => {
    assert.deepEqual(ticks(createFrameClock(), [5000]), [0]);
    assert.deepEqual(ticks(createFrameClock(40_000), [5000]), [40_000]);
  });

  it("adds the time between ticks, at most 100 ms per tick and never backwards", () => {
    assert.deepEqual(
      ticks(createFrameClock(), [1000, 1016, 1049]),
      [0, 16, 49]
    );
    assert.deepEqual(
      ticks(createFrameClock(), [1000, 1250, 1266]),
      [0, 100, 116]
    );
    assert.deepEqual(ticks(createFrameClock(), [1000, 990]), [0, 0]);
  });

  it("skips the time between pause and the next tick", () => {
    const clock = createFrameClock();
    assert.deepEqual(ticks(clock, [1000, 1020]), [0, 20]);
    clock.pause();
    assert.deepEqual(ticks(clock, [600_000, 600_030]), [20, 50]);
  });

  it("holds its time across repeated pauses", () => {
    const clock = createFrameClock(500);
    ticks(clock, [0, 16]);
    clock.pause();
    assert.deepEqual(ticks(clock, [90_000]), [516]);
    clock.pause();
    assert.deepEqual(ticks(clock, [95_000]), [516]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails.** `node --test src/lib/frame-clock.test.ts` fails with `ERR_MODULE_NOT_FOUND` for `./frame-clock.ts`.
- [ ] **Step 3: Implement `createFrameClock(startMs = 0): FrameClock`** in `src/lib/frame-clock.ts`. It has no imports and a module constant `maxStepMs = 100`. It keeps `elapsed` and `last: number | undefined`. `pause()` sets `last = undefined`. `tick(now)` adds `Math.min(Math.max(now - last, 0), maxStepMs)` when `last` is set, then sets `last = now` and returns `elapsed`.
- [ ] **Step 4: Run it to verify it passes.** `node --test src/lib/frame-clock.test.ts` reports `ℹ pass 4`, `ℹ fail 0`.
- [ ] **Step 5: Wire the sky** in `space-background.tsx`. Wall-clock time drives `u_time` (line 377) and the meteor (lines 343 and 384-385). The loop stops only in `stop()` (lines 397-401), which `freeze` (404), `sync` (416), `onBlur` (467) and the cleanup (485) all call.
  - Line 5: add `import { createFrameClock } from "@/lib/frame-clock";` above the frame-pacer import. After line 333 (`const meteor = …`), add `const clock = createFrameClock();`. Line 343 becomes `launch(0);`, because meteor times are now sky time.
  - In `frame`, right after `if (!current) return;` (line 372), add `const skyMs = clock.tick(now);`. Line 377 becomes `(skyMs / 1000) % timeWrap`. Lines 384-385 use `skyMs - meteor.at` and `launch(skyMs)`.
  - Add `clock.pause();` to `stop()`. Line 454 (`applyResize`) becomes `if (rafId) return; clock.pause(); frame(performance.now());` and line 464 (`onScroll`) becomes `if (!settled || rafId) return; clock.pause(); frame(performance.now());`.
  - `pacer.step(now)` (line 410) and the pacer `dt` (pointer easing, ripple) stay on wall-clock time.
- [ ] **Step 6: Wire the clouds** in `clouds.ts`. Wall-clock time is used by `startedAt` (line 303) and `elapsed` (lines 388-390). The loop stops only in `stopLoop()` (lines 439-444), which `freeze` (448), `sync` (473), `blur` (542), `webglcontextlost` (554) and dispose (600) all call.
  - Line 18: add the same import. Line 303 becomes `const clock = createFrameClock(timeOffset * 1000);`. Lines 388-390 become `const elapsed = reduced ? timeOffset : clock.tick(now) / 1000;`.
  - Add `clock.pause();` to `stopLoop()`. `drawStill()` (lines 460-462) becomes `if (!ready || lost || rafId) return; clock.pause(); renderFrame(performance.now());`; scroll and resize redraw through it while the scene is held.
  - `prevRender`/`dt` (lines 385-387) and the gust timing (line 524) stay on wall-clock time.
- [ ] **Step 7: Verify.**
  - `rg -n "startedAt|now / 1000|now - meteor" src/components/space-background.tsx src/lib/clouds.ts` prints nothing.
  - `rg -c "clock\.(pause|tick)" src/components/space-background.tsx src/lib/clouds.ts` prints `4` for the sky and `3` for the clouds.
  - `pnpm exec tsc --noEmit` and `pnpm exec eslint src/lib/frame-clock.ts src/lib/frame-clock.test.ts src/components/space-background.tsx src/lib/clouds.ts --max-warnings=0` both exit 0.
- [ ] **Step 8: Runtime check** on `pnpm dev` with the window focused.
  - Hold the scene: run `document.documentElement.toggleAttribute("data-scene-hold", true); dispatchEvent(new Event("scene:hold"))`. `canvas[data-space]` and `canvas[data-clouds]` should report `paused`.
  - Wait 60 s and take a screenshot, release the hold the same way, then take another screenshot right away. The clouds sit where they were; before this task they jumped by 60 s of drift.
  - A shooting star still crosses within 30 s of running time, and the stars keep twinkling.
- [ ] **Step 9: Commit.** Run `pnpm fix`, then `git add src/lib/frame-clock.ts src/lib/frame-clock.test.ts src/components/space-background.tsx src/lib/clouds.ts` and `git commit -m "feat(sky): sky and clouds resume where they stopped"`.

### Task 5: CSS `still` variant and paused twins

**Files:**

- Modify: `src/styles/globals.css` (before line 80 and the 10 blocks in Step 2)

**Interfaces:**

- Consumes: the `data-motion-paused` attribute (Tasks 1 and 2).
- Produces: `@custom-variant still`. Later tasks use `@variant still` only inside a rule with one selector and no pseudo-element. Anything else gets a hand-written `:root[data-motion-paused]` twin.

- [ ] **Step 1: Add the variant** between the last `@font-face` (it ends at line 78) and `@theme inline {` (line 80):

```css
@custom-variant still {
  @media (prefers-reduced-motion: reduce) {
    @slot;
  }

  :root[data-motion-paused] & {
    @slot;
  }
}
```

- [ ] **Step 2: Convert every reduced-motion block.** A twin is the same declarations under the same selectors, each selector prefixed with `:root[data-motion-paused] `, placed right after its `@media` block. The variant form, which replaces the rule in place, looks like `.resume-sheet { @variant still { translate: none; clip-path: none; } }`.
  - Keep the block and add a twin. These are selector lists, pseudo-elements or the universal reset:
    - 496-505, `*, *::before, *::after` with the 4 `!important` durations.
    - 787-794, `.name-signal::before, .name-signal::after, .name-scan, .name-tear`.
    - 1248-1252, `.contact-link::before`; 1723-1727, `.download-pill::after`.
    - 2338-2345, the 4-selector `.repo-tile:hover …` list; 3177-3182, `.topic-panel, .topic-panel:popover-open`; 3184-3190, `.arms-glint, .globe-orb, .globe-fill::after`.
  - 1051-1060: keep `.orbit > .orbit-comet, .orbit > .orbit-whisper` in the block and add a twin. Move `.orbit > .orbit-track { opacity: 0.6 }` out of the block as `@variant still`.
  - 1589-1598 (`.resume-sheet`, `.resume-line`) and 3444-3448 (`.privacy-chip:active > .privacy-chip-face`): drop the `@media` block and write each rule as `@variant still` in the same place, which keeps the cascade order.
  - Never use a top-level `@variant still`: it emits `:root[data-motion-paused] :scope …`.
- [ ] **Step 3: Format and count.**
  - `pnpm exec prettier --write src/styles/globals.css` wraps the long `.repo-tile:has(…) .repo-planet` twin.
  - `rg -c "prefers-reduced-motion" src/styles/globals.css` prints `9`, `rg -c "data-motion-paused" src/styles/globals.css` prints `21` and `rg -c "@variant still" src/styles/globals.css` prints `4`.
- [ ] **Step 4: Verify the built CSS.** Save this script as `check-still.mjs` outside the repo, for example in your scratchpad:

```js
import { readFileSync } from "node:fs";
const css = process.argv
  .slice(2)
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");
const split = (list) => {
  const parts = [""];
  let depth = 0;
  for (const c of list) {
    depth += c === "(" ? 1 : c === ")" ? -1 : 0;
    if (c === "," && depth === 0) parts.push("");
    else parts[parts.length - 1] += c;
  }
  return parts.map((part) => part.trim());
};
const selectors = (text) =>
  [...text.matchAll(/(?:^|[{};])([^{}@;]+)\{/g)].flatMap(([, list]) =>
    split(list)
  );
const reduced = new Set();
const media = /@media \(prefers-reduced-motion: ?reduce\)\{/g;
for (let m = media.exec(css); m; m = media.exec(css)) {
  let i = media.lastIndex;
  for (let depth = 1; depth > 0; i += 1)
    depth += css[i] === "{" ? 1 : css[i] === "}" ? -1 : 0;
  for (const s of selectors(css.slice(media.lastIndex, i - 1))) reduced.add(s);
}
const prefix = ":root[data-motion-paused] ";
const paused = new Set(
  selectors(css)
    .filter((s) => s.startsWith(prefix))
    .map((s) => s.slice(prefix.length).replace(/^:is\((.*)\)$/, "$1"))
);
const missing = [...reduced].filter((s) => !paused.has(s));
console.log(
  `scope: ${css.split(":scope").length - 1}, reduced selectors: ${reduced.size}, missing twins: ${missing.join(" | ") || "none"}`
);
```

Run `pnpm build && node <scratch>/check-still.mjs dist/_next/static/chunks/*.css`. Expected output: `scope: 0, reduced selectors: 24, missing twins: none`. On today's build the script lists all 24 selectors as missing. The minifier writes `::before` as `:before` and wraps nested complex selectors in `:is()`, and the script normalises both.

- [ ] **Step 5: Spot check** on `pnpm dev`. After `document.documentElement.toggleAttribute("data-motion-paused", true)`:
  - `getComputedStyle(document.querySelector(".orbit > .orbit-track")).opacity` is `"0.6"`.
  - `getComputedStyle(document.querySelector(".contact-link"), "::before").display` is `"none"`.
  - The orbit comet is gone.
- [ ] **Step 6: Commit.** Run `pnpm fix`, then `git add src/styles/globals.css` and `git commit -m "feat(css): still variant and paused twins for every reduced-motion rule"`.

### Task 6: Pause button and page dock

**Files:**

- Create: `src/components/motion-toggle.tsx`, `src/components/page-dock.tsx`
- Modify:
  - `src/lib/i18n.ts:122-123`, `src/lib/icon-data.ts` (via `pnpm icons`)
  - `src/components/privacy-note.tsx:13,35`, `src/app/page.tsx:10,80`
  - `src/styles/globals.css`: line numbers below are given at `51dbaf0`, then after Task 5

**Interfaces:**

- Consumes: `isMotionPaused`, `setMotionPaused` and `subscribeMotionPause` (Task 1), and `data-js` (Task 2).
- Produces: `MotionToggle(): ReactElement`, `PageDock({ email }: PageDockProps): ReactElement`, `en.motion`, and `.page-dock`. `.page-dock` becomes fixed under `@media (min-width: 48em) and (min-height: 45em)`; Task 12 switches that to `no-scroll`.

- [ ] **Step 1: Add i18n.** Insert `motion: { label: "Pause motion", tipPause: "Stills the sky, clouds and planets.", tipPlay: "Motion is paused. Press again to play." },` between `meta` (it closes at line 122) and `notFound` (line 123).
- [ ] **Step 2: Create `src/components/motion-toggle.tsx`** (`"use client"`) with `export const MotionToggle = (): ReactElement`.
  - State is `useSyncExternalStore(subscribeMotionPause, isMotionPaused, () => false)`, plus `useState(false)` for `dismissed`.
  - Use refs on the wrapper and the button. One `useEffect` adds a `document` `keydown` listener that sets `dismissed` on Escape when the wrapper matches `:hover` or the button matches `:focus-visible`, as `contact-links.ts:191-198` does. The effect removes the listener on cleanup.
  - Markup:
    - `span.motion-item` gets `data-dismissed={dismissed ? "" : undefined}` and `onPointerLeave` sets `dismissed` to false. It contains:
      - `button.motion-toggle` with `type="button"`, `aria-label={en.motion.label}`, `aria-pressed={paused}`, `aria-describedby={paused ? "motion-tip-play" : "motion-tip-pause"}`, `onBlur` setting `dismissed` to false and `onClick={() => { setMotionPaused(!paused); }}`. Inside it, `span.motion-toggle-face.fade-up.delay-4` with `aria-hidden="true"` holds `<Icon className="motion-icon-pause" name="lucide:pause" size="1rem" />` and `<Icon className="motion-icon-play" name="lucide:play" size="1rem" />`.
      - `span#motion-tip.contact-tip.motion-tip` with `role="tooltip"`, holding `span#motion-tip-pause.motion-tip-pause` (`en.motion.tipPause`) and `span#motion-tip-play.motion-tip-play` (`en.motion.tipPlay`).
- [ ] **Step 3: Add the dock.**
  - `src/components/page-dock.tsx` is a server component. It has an unexported `interface PageDockProps { email: string }` and `export const PageDock = ({ email }: PageDockProps): ReactElement` returning `<footer className="page-dock"><MotionToggle /><PrivacyNote email={email} /></footer>`.
  - In `privacy-note.tsx`, line 13 becomes `<div className="privacy-note">` and line 35 becomes `</div>`.
  - In `page.tsx`, line 10 becomes `import { PageDock } from "@/components/page-dock";` and line 80 becomes `<PageDock email={contact.email} />`.
- [ ] **Step 4: Add the icons.**
  - Run `pnpm add -D @iconify-json/circle-flags @iconify-json/lucide @iconify-json/simple-icons`, then `pnpm icons`, then `pnpm remove @iconify-json/circle-flags @iconify-json/lucide @iconify-json/simple-icons`.
  - `git diff --stat package.json pnpm-lock.yaml` prints nothing, and `rg -c '"lucide:(pause|play)"' src/lib/icon-data.ts` prints `2`.
  - If newer sets changed other entries, keep the regenerated file and say so in the commit body.
- [ ] **Step 5: Add the CSS.** Today's positioning lives on `.privacy-note`, at lines 3192-3206 at `51dbaf0` and 3255-3269 after Task 5:

```css
.privacy-note {
  position: relative;
  z-index: 20;
  width: fit-content;
  max-width: calc(100% - 2rem);
  margin: 0 auto var(--privacy-y);
}

@media (min-width: 48em) and (min-height: 45em) {
  .privacy-note {
    position: fixed;
    inset: auto 0 var(--privacy-y);
    margin-block: 0;
  }
}
```

- Rename both selectors to `.page-dock`, keeping the same media query. Add `display: flex; align-items: center; justify-content: center; gap: 0.5rem;` to the base rule.
- `:root[data-privacy-ack] .privacy-note { display: none; }` (line 3372, after Task 5 line 3435) stays as it is: it now hides only the chip, and the toggle stays.
- After the dock rules, add the toggle rules:
  - `.motion-item { display: inline-flex; }`, not positioned.
  - `:root:not([data-js]) .motion-item { display: none; }`.
  - `@media (prefers-reduced-motion: reduce) { .motion-item { display: none; } }`. This is the one reduced-motion rule without a paused twin, because the button must stay to resume.
  - `.motion-toggle`: a `2.75rem` round hit area, `display: inline-grid; place-items: center; color: var(--foreground-soft); cursor: pointer`, with `outline: none` on `:focus-visible`.
  - `.motion-toggle-face`: a `2rem` circle with the `.privacy-chip-face` glass: `1px solid var(--border-strong)`, `color-mix(in oklab, var(--background) 82%, transparent)` and `blur(12px) saturate(1.2)`, with both prefixed and unprefixed `backdrop-filter`. The shadow is tinted with `--primary`, and border-color and color transition. The focus ring is `.motion-toggle:focus-visible > .motion-toggle-face { outline: 2px solid var(--primary); outline-offset: 3px; }`.
  - `[aria-pressed="true"]` and fine-pointer `:hover` both set the face to `border-color: color-mix(in oklab, var(--primary) 55%, transparent); color: var(--foreground)`.
  - Swaps: `.motion-icon-play, .motion-tip-play, :root[data-motion-paused] .motion-icon-pause, :root[data-motion-paused] .motion-tip-pause { display: none; }`, `:root[data-motion-paused] .motion-icon-play { display: block; }` and `:root[data-motion-paused] .motion-tip-play { display: inline; }`.
  - `.motion-tip { --tone: var(--primary); width: max-content; max-width: calc(100vw - 2rem); white-space: normal; text-align: center; }`.
  - `@media (forced-colors: active)`: the face gets `ButtonFace` background, `ButtonText` border and color, and `Highlight`/`HighlightText` when `[aria-pressed="true"]`.
- Tip show and dismiss rules: append `.motion-item:hover > .contact-tip` to the rule at line 1326 (after Task 5 line 1363), `.motion-toggle:focus-visible + .contact-tip` to line 1339 (1376), and `.motion-item[data-dismissed] > .contact-tip` to line 1351 (1388).
- Print: at line 3496 (after Task 5 line 3559), `.privacy-note,` becomes `.page-dock,`.
- [ ] **Step 6: Verify the build.**
  - `pnpm exec tsc --noEmit` and `pnpm exec eslint src/components/motion-toggle.tsx src/components/page-dock.tsx src/components/privacy-note.tsx src/app/page.tsx src/lib/i18n.ts --max-warnings=0` both exit 0.
  - Run `pnpm build`. Each of `grep -o '<footer class="page-dock">' dist/index.html | wc -l`, `grep -o 'aria-label="Pause motion"' dist/index.html | wc -l`, `grep -o 'aria-describedby="motion-tip-pause"' dist/index.html | wc -l` and `grep -o '<div class="privacy-note">' dist/index.html | wc -l` prints `1`.
  - `node <scratch>/check-still.mjs dist/_next/static/chunks/*.css` prints `scope: 0, reduced selectors: 25, missing twins: .motion-item`.
- [ ] **Step 7: Runtime check** on the `dev` launch configuration, using the Browser pane's JavaScript tool.
  - Run `const b = document.querySelector(".motion-toggle"); b.click(); await new Promise((r) => setTimeout(r, 200)); [document.documentElement.hasAttribute("data-motion-paused"), localStorage.getItem("motion-paused"), b.getAttribute("aria-pressed"), b.getAttribute("aria-describedby"), document.querySelector("canvas[data-space]").dataset.spaceState]`. It returns `[true, "1", "true", "motion-tip-play", "paused"]`.
  - Reload. `[document.documentElement.hasAttribute("data-motion-paused"), getComputedStyle(document.querySelector(".motion-icon-play")).display]` returns `[true, "block"]`.
  - Click again. The first three values become `false, null, "false"`, and the sky state returns to what it was before the first click.
  - Run `localStorage.setItem("privacy-ack", "1")` and reload. `.privacy-note` computes `display: none` and `.motion-item` computes `inline-flex`. Then run `localStorage.clear()`.
- [ ] **Step 8: Commit.** Run `pnpm fix`, then `git add src/lib/i18n.ts src/lib/icon-data.ts src/components/motion-toggle.tsx src/components/page-dock.tsx src/components/privacy-note.tsx src/app/page.tsx src/styles/globals.css` and `git commit -m "feat(card): pause motion button beside the privacy chip in a page dock"`.

### Notes from the writers of Tasks 7 to 11

Everything below was checked in a scratch copy of the touched modules (repo `node_modules`, repo `tsconfig.json`, `worker/tsconfig.json`, `eslint.config.ts` and knip rules): all tests in these tasks pass, `tsc` and ESLint are clean.

1. `MarkLayer` stays **unexported** in `src/lib/product-marks.ts`. knip's `types` rule reports an exported type that only another type in the same file uses. Probe with the repo's knip on the Task 7 files: exported `MarkLayer` gives "Unused exported types: MarkLayer"; private, the files are clean. `ProductMark` stays exported (the imported `productMarks` annotation keeps it clean). A later task that imports the layer type exports it in that commit.
2. `ProfileProduct` is exported and imported by `src/profile/readme.ts` (`productLine(product: ProfileProduct)`). Without an importer knip flags it (same rule as note 1).
3. `structuredData` keeps its third parameter name `modified` (the contract writes `now`). It is positional, so callers do not change.
4. The profile README product line bolds the link like the repo lines: `- **[name](url)** · meta. line` (the contract allows matching the existing list style). The section is left out when the list is empty (no "## 0 products"), as `ProductStrip` returns `null`.
5. Person `@id` confirmed: `https://stevanpavlovic.com/#person` (`${site}#person` with `site = ${personalData.website}/`), so product ids `${site}#product-${key}` equal the contract's `${personalData.website}/#product-${key}`. No change.
6. Declaration order follows `perfectionist/sort-modules` (lint error otherwise): `export interface Product` before `export type ProductKey`; `export interface ProductMark` before `interface MarkLayer`; `ProfileProduct` after `ProfilePerson`.

### Task 7: Product data

**Files:**

- Modify: `src/lib/theme.ts:35` (append `productPalette` after `profilePalette`)
- Modify: `src/lib/i18n.ts:136` (new `products` block between `privacy` and `profile`; Task 6's `motion` sits between `meta` and `notFound`, no overlap)
- Create: `src/lib/products.ts`
- Create: `src/lib/product-marks.ts`
- Test: `src/lib/products.test.ts`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces:
  - `src/lib/theme.ts`: `export const productPalette = { hirista: {...}, "safety-real-time": {...} } as const;`
  - `src/lib/i18n.ts`: `en.products` with `headingOne`, `headingOther`, `items[key].{line, period, role}`, `llmsHeading`.
  - `src/lib/products.ts`: `export interface Product { applicationCategory: string; key: ProductKey; line: string; name: string; palette: (typeof productPalette)[ProductKey]; period: string; role: string; schemaType: "SoftwareApplication" | "WebApplication"; url: string; }`, `export type ProductKey = keyof typeof productPalette;`, `export const products: readonly Product[]`, `export const productMeta = (product: Product): string`, `export const productLlmsLines = (items: readonly Product[]): string[]`, `export const isProductUrl = (url: string): boolean`.
  - `src/lib/product-marks.ts`: `export interface ProductMark { layers: readonly MarkLayer[]; transform: { scale: number; x: number; y: number }; viewBox: string; }` (`MarkLayer` = `{ d: string; ink: "accent" | "mark" }`, unexported), `export const productMarks: Record<ProductKey, ProductMark>`.

- [ ] **Step 1: Write the failing test** `src/lib/products.test.ts`:

```ts
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import { productMarks } from "./product-marks.ts";
import {
  isProductUrl,
  productLlmsLines,
  productMeta,
  products,
} from "./products.ts";

describe("products", () => {
  it("lists hirista, then Safety Real Time", () => {
    assert.deepEqual(
      products.map((product) => [
        product.key,
        product.name,
        product.schemaType,
        product.url,
      ]),
      [
        ["hirista", "hirista", "WebApplication", "https://hirista.app"],
        [
          "safety-real-time",
          "Safety Real Time",
          "SoftwareApplication",
          "https://safetyrealtime.com",
        ],
      ]
    );
  });
  it("has unique keys, https links and lines of at most 80 characters", () => {
    assert.equal(
      new Set(products.map((product) => product.key)).size,
      products.length
    );
    for (const product of products) {
      assert.equal(new URL(product.url).protocol, "https:", product.key);
      assert.ok(
        product.line.length > 0 && product.line.length <= 80,
        product.key
      );
    }
  });
  it("joins role and period", () => {
    assert.deepEqual(
      products.map((product) => productMeta(product)),
      ["Solo founder · 2026", "Co-founder & CTO · since 2022"]
    );
  });
  it("writes one llms.txt line per product", () => {
    assert.deepEqual(productLlmsLines(products), [
      "- [hirista](https://hirista.app): Solo founder · 2026. Scores your saved jobs and writes the résumé for each.",
      "- [Safety Real Time](https://safetyrealtime.com): Co-founder & CTO · since 2022. Fleet software for trucking: pre-trip checks, live dashboards.",
    ]);
  });
  it("matches a product host with or without www", () => {
    for (const url of [
      "https://hirista.app",
      "https://www.hirista.app/jobs",
      "https://www.safetyrealtime.com/",
    ]) {
      assert.equal(isProductUrl(url), true, url);
    }
    for (const url of [
      "https://app.hirista.app",
      "https://example.com/hirista.app",
      "hirista.app",
      "",
    ]) {
      assert.equal(isProductUrl(url), false, url);
    }
  });
  it("has a mark for every product", () => {
    assert.deepEqual(
      Object.entries(productMarks).map(([key, mark]) => [
        key,
        mark.viewBox,
        mark.transform,
        mark.layers.map((layer) => layer.ink),
      ]),
      [
        [
          "hirista",
          "0 0 24 24",
          { scale: 0.88, x: 1.22, y: 2.06 },
          ["mark", "accent"],
        ],
        [
          "safety-real-time",
          "0 0 100 100",
          { scale: 0.74, x: 13, y: 28.91 },
          ["mark", "mark", "mark", "mark", "mark", "mark"],
        ],
      ]
    );
  });
  it("keeps the Safety Real Time paths byte for byte", () => {
    const paths = productMarks["safety-real-time"].layers
      .map((layer) => layer.d)
      .join("\n");
    assert.equal(
      createHash("sha256").update(paths).digest("hex"),
      "f69a555b29079352378538e935b6ada790f5f96308f036d1c919d8fa76bbc17a"
    );
  });
});
```

Test URLs stay `https:` (`unicorn/prefer-https` flags `http://` literals, tests included).

- [ ] **Step 2: Run it to verify it fails**: `node --test src/lib/products.test.ts`. Expected: FAIL, `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../src/lib/product-marks.ts'`.

- [ ] **Step 3: Add the palette and the copy** (exact data). In `src/lib/theme.ts`, after `profilePalette`:

```ts
export const productPalette = {
  hirista: {
    accent: "#f79900",
    disc: "#1c1410",
    mark: "#efebe2",
    tint: "#f79900",
  },
  "safety-real-time": {
    accent: "#1f232c",
    disc: "#32d74b",
    mark: "#1f232c",
    tint: "#32d74b",
  },
} as const;
```

In `src/lib/i18n.ts`, between `privacy` and `profile`:

```ts
  products: {
    headingOne: "{count} product",
    headingOther: "{count} products",
    items: {
      hirista: { line: "Scores your saved jobs and writes the résumé for each.", period: "2026", role: "Solo founder" },
      "safety-real-time": { line: "Fleet software for trucking: pre-trip checks, live dashboards.", period: "since 2022", role: "Co-founder & CTO" },
    },
    llmsHeading: "Products",
  },
```

- [ ] **Step 4: Implement `src/lib/products.ts`** (imports `./i18n.ts` and `./theme.ts` only). `export interface Product` first, then `export type ProductKey` (note 6).
  - `products`: two entries shaped `{ applicationCategory: "BusinessApplication", key, name, palette: productPalette[key], schemaType, url, ...en.products.items[key] }`: first `("hirista", "hirista", "WebApplication", "https://hirista.app")`, then `("safety-real-time", "Safety Real Time", "SoftwareApplication", "https://safetyrealtime.com")`.
  - `productMeta`: `` `${product.role} · ${product.period}` ``.
  - `productLlmsLines`: one `` `- [${item.name}](${item.url}): ${productMeta(item)}. ${item.line}` `` per item.
  - `isProductUrl`: a private `bareHost = (url: string): string | undefined => URL.parse(url)?.hostname.replace(/^www\./, "")`; true when `bareHost(url)` is defined and equals `bareHost(product.url)` for some product. `URL.parse` returns `null` for invalid input, so `"hirista.app"` and `""` are false.

- [ ] **Step 5: Create `src/lib/product-marks.ts`** with exactly this content. The hirista paths come from the spec; the six Safety Real Time `d` strings are the `SRT` object of `.superpowers/brainstorm/66805-1791462029/content/logos.html` in key order streak, chk2, chk1, roof, hood, wheel (verified against `srt_logo.svg`); Step 1 pins their SHA-256, so copy them, never retype:

```ts
import type { ProductKey } from "./products.ts";

export interface ProductMark {
  layers: readonly MarkLayer[];
  transform: { scale: number; x: number; y: number };
  viewBox: string;
}

interface MarkLayer {
  d: string;
  ink: "accent" | "mark";
}

export const productMarks: Record<ProductKey, ProductMark> = {
  hirista: {
    layers: [
      { d: "M6 3.5H10.6V9.5L7.6 6.5H6Z", ink: "mark" },
      {
        d: "M7.6 7.8L10.6 10.8A5.2 5.2 0 0 1 18 15.51V19.1H15V15.51A2.2 2.2 0 0 0 10.6 15.51V19.1H7.6Z",
        ink: "accent",
      },
    ],
    transform: { scale: 0.88, x: 1.22, y: 2.06 },
    viewBox: "0 0 24 24",
  },
  "safety-real-time": {
    layers: [
      {
        d: "M26.243 22.4114C24.994 23.0985 23.6642 23.6294 22.2838 23.9921C19.923 24.607 17.5717 24.6243 15.3573 23.5179C13.9755 22.835 12.8707 21.7475 11.8837 20.5573C9.71865 17.9571 7.52496 15.3743 5.34718 12.7899C5.05904 12.4469 4.79478 12.0849 4.38247 11.5538C5.73721 11.8257 6.88977 12.0106 8.01687 12.2935C9.64701 12.6998 11.3154 12.8057 12.971 12.9859C14.9599 13.2032 16.9631 13.2619 18.9615 13.1613C21.7601 13.0206 24.5539 12.7693 27.351 12.5939C31.49 12.3315 35.6482 12.3204 39.7283 13.3842C41.7469 13.9137 43.67 14.674 45.5867 15.4675C45.9064 15.6109 46.198 15.8094 46.4479 16.054C49.0332 18.4913 51.6026 20.9461 54.1863 23.3851C55.4965 24.6228 56.8257 25.8399 58.1439 27.0665C58.2362 27.1534 58.3126 27.2562 58.5657 27.5407C57.047 27.0396 55.7591 26.6286 54.4378 26.3251C52.3347 25.8464 50.1814 25.6193 48.0239 25.6486C44.0822 25.7158 40.1723 26.3631 36.4219 27.5691C34.9111 28.0433 33.4417 28.6977 31.8052 28.6851C29.6975 28.6661 28.3523 27.5106 27.394 25.7877C26.8209 24.7555 26.5041 23.6222 26.2382 22.4114",
        ink: "mark",
      },
      {
        d: "M7.56972 45.0846C9.51501 43.7384 11.3809 42.4731 13.2198 41.1507C13.6486 40.8418 13.855 41.0952 14.1218 41.2774C17.0548 43.2633 19.9973 45.2366 22.9049 47.2606C23.5084 47.6803 23.8577 47.7024 24.4516 47.202C28.6963 43.5959 33.0554 40.1323 37.8416 37.25C42.0911 34.6876 46.5914 32.7681 51.5555 32.0919C53.351 31.8532 55.1671 31.8091 56.9721 31.9604C55.1909 32.336 53.446 32.866 51.7572 33.5441C47.4934 35.2751 43.7743 37.8677 40.2744 40.7975C35.323 44.9436 30.9735 49.6963 26.5414 54.3635C25.9348 54.997 25.3187 55.6305 24.7423 56.2972C24.4596 56.625 24.242 56.6599 23.8831 56.4096C18.4745 52.6483 13.0594 48.895 7.56972 45.0846Z",
        ink: "mark",
      },
      {
        d: "M55.0525 28.8485C53.3316 28.459 51.5765 28.2432 49.8132 28.2042C45.0915 28.0722 40.5552 29.0772 36.1004 30.5493C33.0341 31.5639 30.0812 32.8702 27.114 34.1361C26.5979 34.3648 26.0546 34.5371 25.5961 34.8866L24.5718 35.3811C23.6243 35.6146 22.8286 36.1864 21.9497 36.5713C21.5279 36.7598 21.1237 36.9611 20.7162 36.5568C20.5912 36.5733 20.4652 36.5819 20.3391 36.5826C20.4652 36.5819 20.5912 36.5733 20.7162 36.5568L17.1019 32.4627C16.5596 31.8592 16.0185 31.2542 15.4784 30.6475C14.2816 29.3059 13.0816 27.9659 11.8912 26.621C11.6388 26.3359 11.4231 26.2344 10.9917 26.3295C8.58633 26.8717 6.14365 27.2293 3.68466 27.3989C2.51183 27.4778 1.33581 27.5245 0 27.5471C0.239678 27.7371 0.33555 27.8225 0.441008 27.895C7.98928 33.1338 15.5349 38.3795 23.0778 43.6322C23.4885 43.9173 23.7361 43.8787 24.1132 43.563C27.6797 40.5672 31.3787 37.7519 35.3174 35.27C41.41 31.4383 47.9021 28.9322 55.2267 29.1851C55.2778 29.1851 55.3337 29.1078 55.3785 29.0739C55.3226 28.8726 55.1756 28.8758 55.0493 28.8469",
        ink: "mark",
      },
      {
        d: "M71.3147 13.1474C68.5396 11.5396 65.6719 10.1009 62.7269 8.83911C59.8308 7.6142 56.8501 6.60464 53.8085 5.81845C50.7985 5.03958 47.7328 4.50006 44.6395 4.20485C43.8667 4.13386 43.0956 4.06447 42.3228 4.03059L41.1653 3.96282L40.003 3.94507C38.9844 3.92409 37.9116 3.91925 36.8387 3.91602C36.5194 5.79963 36.1846 7.68216 35.8344 9.56361H32.2709C32.2789 9.49261 32.2885 9.41839 32.2981 9.34578C32.6174 6.78177 32.959 4.22099 33.3215 1.66505C33.3862 1.20759 33.6123 0.7892 33.9583 0.487023C34.3042 0.184846 34.7466 0.0192605 35.2038 0.0207975H35.2246C36.8451 0.0207975 38.4017 -0.0259968 40.0813 0.0207975L41.3298 0.0530694L42.5751 0.13859C43.4085 0.177316 44.2355 0.2822 45.0609 0.387084C48.3634 0.796149 51.6129 1.56215 54.7537 2.67194C57.8735 3.7789 60.8654 5.22453 63.6768 6.98347C66.4612 8.7439 69.0668 10.7722 71.3147 13.1442",
        ink: "mark",
      },
      {
        d: "M99.2749 46.1742C99.1667 46.2055 99.0541 46.219 98.9415 46.2142C96.6425 46.1134 76.6088 45.4048 74.3082 45.1537C76.331 44.9345 92.0636 44.3619 97.3967 44.1539L96.1821 41.1851L94.4769 36.8358L94.0514 35.7513L93.8386 35.2074L93.637 34.7563C93.3611 34.1656 93.026 33.605 92.6367 33.0831C91.8562 32.0536 90.8541 31.2157 89.7058 30.6326C89.1408 30.337 88.5427 30.1104 87.9244 29.9575C87.7656 29.9143 87.6227 29.8903 87.4767 29.8632C87.3157 29.8315 87.1529 29.8096 86.9893 29.7976L85.8413 29.66L81.256 29.0858C78.2013 28.6843 75.1481 28.286 72.0981 27.8445H72.087C71.6284 27.7783 71.2089 27.5478 70.9053 27.1952C70.6018 26.8427 70.4345 26.3917 70.4342 25.925C70.4342 24.3622 70.3485 22.8169 70.0389 21.4029C69.7293 19.9889 69.2085 18.7236 68.3797 17.8838C67.5763 17.02 66.4078 16.5433 65.0138 16.401L64.4835 16.3578L63.8643 16.3338L62.6243 16.2826L60.1443 16.1818C58.4899 16.1243 56.8387 16.0219 55.1859 15.9339C53.9157 15.8587 52.6582 15.7963 51.3944 15.7148V13.8016C52.6646 13.7185 53.9221 13.6561 55.1859 13.5825C56.8387 13.4865 58.4899 13.3905 60.1443 13.333L62.6243 13.2338L63.8643 13.1826L64.4835 13.1586L65.1916 13.1474C66.1903 13.1625 67.1804 13.3358 68.1257 13.6609C69.1293 14.0133 70.0506 14.5691 70.8327 15.2941C72.403 16.7769 73.2365 18.7076 73.6811 20.5167C73.9736 21.7276 74.1559 22.9628 74.2257 24.207C76.7565 24.5461 79.2841 24.906 81.8133 25.2659L86.3955 25.9585L87.5418 26.1345C87.7164 26.1585 87.9482 26.2065 88.1769 26.2625C88.4055 26.3185 88.6436 26.3648 88.8564 26.4336C91.4981 27.1856 93.7888 28.8585 95.32 31.154C95.8192 31.9022 96.228 32.7077 96.5377 33.5534L96.7521 34.1773L96.9235 34.7355L97.2649 35.8552L98.6272 40.3181L99.9291 44.797L99.9592 44.8993C99.9967 45.0286 100.009 45.1641 99.994 45.298C99.9795 45.4319 99.9389 45.5616 99.8746 45.6796C99.8103 45.7977 99.7236 45.9019 99.6193 45.9862C99.5151 46.0705 99.3954 46.1333 99.267 46.171",
        ink: "mark",
      },
      {
        d: "M36.255 46.2151C38.1863 46.2072 46.5071 46.1849 48.4384 46.1483H48.5464H48.5639C49.0402 46.1321 49.4907 45.9271 49.8162 45.5783C50.1417 45.2295 50.3156 44.7655 50.2998 44.2882C50.2788 43.439 50.4305 42.5944 50.7456 41.8057C51.0606 41.0171 51.5326 40.3009 52.1326 39.7008C52.7484 39.0786 53.4837 38.5882 54.2942 38.2591C54.7053 38.0946 55.1306 37.9684 55.5648 37.882C55.7856 37.8438 56.0111 37.8247 56.2366 37.7929L57.0451 37.7388L57.8551 37.6799C58.0838 37.6799 58.3172 37.6561 58.5491 37.6577C59.0176 37.6739 59.4834 37.7346 59.9404 37.8391C60.882 38.0687 61.7703 38.4788 62.5563 39.0468C63.369 39.6527 64.0585 40.4089 64.5876 41.2745C65.135 42.1981 65.498 43.2195 65.6565 44.2818C65.9964 42.0955 65.2515 39.6419 63.5918 37.8916C62.7616 36.9847 61.7399 36.2747 60.6011 35.8135C60.0205 35.5809 59.4182 35.4066 58.8032 35.2931C58.4951 35.2422 58.1807 35.2152 57.8662 35.1786L57.0403 35.1133L56.2144 35.064C55.8968 35.064 55.5791 35.0545 55.2519 35.064C54.6074 35.1041 53.9687 35.2108 53.346 35.3822C51.991 35.773 50.7418 36.4662 49.6924 37.4098C48.643 38.3534 47.8206 39.5229 47.2869 40.8305C47.0855 41.3362 46.7804 41.7939 46.3913 42.174C46.0023 42.5542 45.538 42.8484 45.0284 43.0375L36.255 46.2151Z",
        ink: "mark",
      },
    ],
    transform: { scale: 0.74, x: 13, y: 28.91 },
    viewBox: "0 0 100 100",
  },
};
```

- [ ] **Step 6: Run it to verify it passes**: `node --test src/lib/products.test.ts`. Expected: PASS, `ℹ tests 7`, `ℹ fail 0`.

- [ ] **Step 7: Commit** (run `pnpm fix` first; the hook runs `pnpm check`, which must pass: knip accepts the new exports because the test imports them)

```bash
git add src/lib/theme.ts src/lib/i18n.ts src/lib/products.ts src/lib/product-marks.ts src/lib/products.test.ts
git commit -m "feat(products): add product data, palette and marks"
```

### Task 8: JSON-LD products

**Files:**

- Modify: `src/lib/structured-data.ts:1-6` (imports), `:21-25` (signature), `:92-93` (product nodes after the repo nodes)
- Modify: `src/app/page.tsx:15-19` (import), `:50` (the `structuredData(...)` call; Task 6 may have shifted the lines)
- Test: `src/lib/structured-data.test.ts` (create)

**Interfaces:**

- Consumes: `products`, `type Product` (Task 7).
- Produces: `export const structuredData = (repos: Repo[], contact: Contact, modified: Date, items: readonly Product[]): Graph` (note 3).

- [ ] **Step 1: Write the failing test** `src/lib/structured-data.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";

import type { Contact, Repo } from "./github.ts";

import { products } from "./products.ts";
import { structuredData } from "./structured-data.ts";

const contact: Contact = {
  email: "ada@example.com",
  linkedin: "https://www.linkedin.com/in/ada/",
  linkedinHandle: "ada",
};
const repo: Repo = {
  description: "A fast engine",
  forks: 0,
  languages: [],
  name: "engine",
  stars: 1,
  topics: [],
  url: "https://github.com/ada/engine",
};
const person = "https://stevanpavlovic.com/#person";
const graph = z
  .array(z.looseObject({ "@id": z.string().optional(), "@type": z.string() }))
  .parse(structuredData([repo], contact, new Date(0), products)["@graph"]);

describe("structuredData", () => {
  it("adds one node per product after the repos", () => {
    assert.deepEqual(
      graph.map((node) => node["@type"]),
      [
        "WebSite",
        "ProfilePage",
        "Person",
        "SoftwareSourceCode",
        "WebApplication",
        "SoftwareApplication",
      ]
    );
    assert.deepEqual(graph.slice(4), [
      {
        "@id": "https://stevanpavlovic.com/#product-hirista",
        "@type": "WebApplication",
        applicationCategory: "BusinessApplication",
        creator: { "@id": person },
        description: "Scores your saved jobs and writes the résumé for each.",
        name: "hirista",
        url: "https://hirista.app",
      },
      {
        "@id": "https://stevanpavlovic.com/#product-safety-real-time",
        "@type": "SoftwareApplication",
        applicationCategory: "BusinessApplication",
        creator: { "@id": person },
        description:
          "Fleet software for trucking: pre-trip checks, live dashboards.",
        name: "Safety Real Time",
        url: "https://safetyrealtime.com",
      },
    ]);
  });
  it("credits the person node as the creator", () => {
    assert.equal(graph[2]?.["@id"], person);
  });
  it("never claims an employer", () => {
    assert.doesNotMatch(JSON.stringify(graph), /worksFor/);
  });
});
```

`zod` parses the graph because schema-dts's `Thing` union includes string enumerations, so `node["@type"]` does not type-check on the raw graph (TS7053).

- [ ] **Step 2: Run it to verify it fails**: `node --test src/lib/structured-data.test.ts`. Expected: FAIL, `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/lib' imported from .../src/lib/structured-data.ts` (the module still uses the alias).

- [ ] **Step 3: Implement the product nodes in `src/lib/structured-data.ts`.** Imports become `import type { Contact, Repo } from "./github.ts";`, `import type { Product } from "./products.ts";`, `import { en } from "./i18n.ts";`, `import { personalData, plainName } from "./personal.ts";` (keep `import type ... from "schema-dts"`; whole-statement `import type` so Node erases them). Add the fourth parameter `items: readonly Product[]` and append `...items.map((product) => ({ ... }) as const)` after the repo nodes with exactly the keys of the test: `` "@id": `${site}#product-${product.key}` ``, `"@type": product.schemaType`, `applicationCategory`, `creator: { "@id": personId }`, `description: product.line`, `name`, `url`. The `@type` union type-checks against `Graph` (checked with `tsc`). No dates, no `offers`, no Organization, no `worksFor`.

- [ ] **Step 4: Pass the products from `src/app/page.tsx`**: `import { products } from "@/lib/products";` and `structuredData(repos, contact, new Date(), products)`.

- [ ] **Step 5: Fix the JSON-LD escape.** `serializeJsonLd` today is `JSON.stringify(data).replaceAll("<", "<")`, a no-op, so a `</script>` inside a repo description would end the `<script type="application/ld+json">` early. Add to `structured-data.test.ts`:

```ts
it("escapes < so a string cannot close the script tag", () => {
  const json = serializeJsonLd({
    "@context": "https://schema.org",
    "@graph": [{ "@type": "Thing", name: "</script><b>" }],
  });
  assert.equal(json.includes("<"), false);
  assert.equal(json.includes(String.raw`\u003c/script>`), true);
  assert.equal(JSON.parse(json)["@graph"][0].name, "</script><b>");
});
```

Run it (FAIL: `json.includes("<")` is true), then change the replacement to `"\\u003c"` (the six characters `\u003c`) and import `serializeJsonLd` in the test.

- [ ] **Step 6: Run it to verify it passes**: `node --test src/lib/structured-data.test.ts`. Expected: PASS, `ℹ tests 4`, `ℹ fail 0`.

- [ ] **Step 7: Commit** (run `pnpm fix` first; the hook runs `pnpm check`, including `pnpm build`)

```bash
git add src/lib/structured-data.ts src/lib/structured-data.test.ts src/app/page.tsx
git commit -m "feat(seo): add the products to the JSON-LD graph"
```

After the hook passes, `rg -o '#product-[a-z-]+' dist/index.html | sort -u` prints `#product-hirista` and `#product-safety-real-time`.

### Task 9: `llms.txt` Products section and résumé dedupe

**Files:**

- Modify: `src/lib/cv-llms.ts:1-2` (import), `:54-57` (`projectLines` filter)
- Modify: `src/app/llms.txt/route.ts:1-5` (import), `:33-34` (new section)
- Test: `src/lib/cv-llms.test.ts` (helper after `full`, one new `it`)

**Interfaces:**

- Consumes: `products`, `productLlmsLines`, `isProductUrl`, `en.products.llmsHeading` (Task 7).
- Produces: `/llms.txt` gains `## Products` right after `## Open-source projects`; Task 10 reads that heading.

- [ ] **Step 1: Write the failing test.** In `src/lib/cv-llms.test.ts`, at module scope after `const full = ...` (`unicorn/consistent-function-scoping` rejects it inside `it`):

```ts
const withProjects = (items: unknown[]): string[] =>
  cvLlmsSections(
    cvSchema.parse({
      projects: { items },
      updatedAt: "2026-10-08T00:00:00.000Z",
    })
  );
```

and inside `describe`, before "drops rows without a name or a heading":

```ts
it("leaves out résumé projects that link to a product", () => {
  assert.deepEqual(
    withProjects([
      {
        name: "hirista",
        overview: "Job search.",
        websiteUrl: "https://www.hirista.app/",
      },
      { name: "Ledger", websiteUrl: "https://example.com/ledger" },
    ]),
    [
      "## Projects from the résumé",
      "",
      "- [Ledger](https://example.com/ledger)",
      "",
    ]
  );
  assert.deepEqual(
    withProjects([{ name: "Fleet", websiteUrl: "https://safetyrealtime.com" }]),
    []
  );
});
```

- [ ] **Step 2: Run it to verify it fails**: `node --test src/lib/cv-llms.test.ts`. Expected: FAIL, 1 of 4: "leaves out résumé projects that link to a product" (the hirista line is still listed).

- [ ] **Step 3: Implement the dedupe in `src/lib/cv-llms.ts`**: `import { isProductUrl } from "./products.ts";`; the `projectLines` filter becomes `(project) => oneLine(project.name) && !isProductUrl(project.websiteUrl)` (the URL parser trims surrounding spaces itself).

- [ ] **Step 4: Run it to verify it passes**: `node --test src/lib/cv-llms.test.ts`. Expected: PASS, `ℹ tests 4`, `ℹ fail 0`.

- [ ] **Step 5: Add the section to `src/app/llms.txt/route.ts`**: `import { productLlmsLines, products } from "@/lib/products";` and, between the `""` after the repo lines and `...cvLlmsSections(cv)`:

```ts
    `## ${en.products.llmsHeading}`,
    "",
    ...productLlmsLines(products),
    "",
```

- [ ] **Step 6: Commit** (run `pnpm fix` first; the hook runs `pnpm check`)

```bash
git add src/lib/cv-llms.ts src/lib/cv-llms.test.ts src/app/llms.txt/route.ts
git commit -m "feat(llms): list the products and drop them from the résumé projects"
```

After the hook passes, `sed -n '/^## Products$/,/^## Experience$/p' dist/llms.txt` prints `## Products`, a blank line, exactly the two lines of Task 7's `productLlmsLines` test, a blank line and `## Experience`; `sed -n '/^## Projects from the résumé$/,/^## Links$/p' dist/llms.txt` lists no `hirista.app` link.

### Task 10: MCP `products` tool

**Files:**

- Modify: `worker/mcp.ts:16` (heading constant), `:133` (register after `projects`)
- Test: `worker/mcp.test.ts:17-21` (fixture), `:166-174`, `:219-226`, `:282-287`, `:365-371`

**Interfaces:**

- Consumes: the `## Products` section of `/llms.txt` (Task 9), matched by the heading text `Products`.
- Produces: a sixth read-only MCP tool `products`, no input.

- [ ] **Step 1: Write the failing test** (edits in `worker/mcp.test.ts`):
  - In `llms`, between the engine line's `""` and `"## Links"`, insert `"## Products"`, `""`, `"- [tripkit](https://tripkit.example): Founder · 2026. Plans trips."`, `""`.
  - Rename "lists exactly the five tools" to "lists exactly the six tools"; expected `["contact", "experience", "products", "profile", "projects", "skills"]`.
  - In "projects returns the Open-source projects section only" add `assert.doesNotMatch(text, /tripkit/);`.
  - After that test add:

```ts
it("products returns the Products section only", async () => {
  const client = await connect(sampleFacts);

  assert.equal(
    await textOf(client, "products"),
    "- [tripkit](https://tripkit.example): Founder · 2026. Plans trips."
  );
});
```

- In "answers not available when a section is missing" add `assert.match(await textOf(client, "products"), /not available/i);` between the `projects` and `contact` lines.
- In "serves tools/list over stateless HTTP" add `"products"` after `"experience"` in the name list.

- [ ] **Step 2: Run it to verify it fails**: `node --test worker/mcp.test.ts`. Expected: FAIL, 4 of 21: "lists exactly the six tools", "products returns the Products section only" (actual `'MCP error -32602: Tool products not found'`), "answers not available when a section is missing", "serves tools/list over stateless HTTP".

- [ ] **Step 3: Implement the tool in `worker/mcp.ts`**: `const productsHeading = "Products";` next to `projectsHeading` (the worker keeps its own copy of the llms.txt headings, like `projectsHeading`); after the `projects` registration, `server.registerTool("products", { annotations: readOnly, description: "Products the site owner founded, one per line: link, role, years and what it does." }, () => textResult(section(llms, productsHeading) ?? unavailable))`.

- [ ] **Step 4: Run it to verify it passes**: `node --test worker/mcp.test.ts`. Expected: PASS, `ℹ tests 21`, `ℹ fail 0`.

- [ ] **Step 5: Commit** (run `pnpm fix` first; the hook runs `pnpm check`, including `tsc -p worker/tsconfig.json`)

```bash
git add worker/mcp.ts worker/mcp.test.ts
git commit -m "feat(mcp): add a products tool"
```

### Task 11: Profile README products section

**Files:**

- Modify: `src/profile/types.ts:14-20` (`ProfileInput.products`), `:30` (`ProfileProduct` after `ProfilePerson`), `:39-54` (`ProfileStrings.products`)
- Modify: `src/profile/readme.ts` (heading helper, product lines, section)
- Modify: `src/profile/cli.ts:10-16` (import), `:47-48` (`products` input)
- Modify: `src/profile/fixtures.ts:40-41` (`products`), `:63` (`strings.products`)
- Test: `src/profile/render.test.ts:14-33` (expected README) and one new `it`

**Interfaces:**

- Consumes: `products`, `productMeta` (Task 7); `en.products.headingOne` / `headingOther`.
- Produces: `export interface ProfileProduct { line: string; meta: string; name: string; url: string; }`; `ProfileInput` gains `products: ProfileProduct[]`; the internal `ProfileStrings` gains `products: { headingOne: string; headingOther: string }`.

- [ ] **Step 1: Write the failing test.** In `src/profile/fixtures.ts`, between `personal` and `repos`:

```ts
  products: [
    { line: "Plans *trips* for you.", meta: "Founder · 2026", name: "trip_kit", url: "https://tripkit.example" },
    { line: "Fleet tools: checks, maps.", meta: "Co-founder & CTO · since 2022", name: "Road Works", url: "https://roadworks.example" },
  ],
```

and in `strings`, between `card` and `profile`: `products: { headingOne: "{count} product", headingOther: "{count} products" },`.

In `src/profile/render.test.ts`, rename `expectedReadme` to `expectedRepos` (content unchanged) and add after it:

```ts
const expectedReadme = String.raw`${expectedRepos}
## 2 products

- **[trip\_kit](https://tripkit.example)** · Founder · 2026. Plans \*trips\* for you.
- **[Road Works](https://roadworks.example)** · Co-founder & CTO · since 2022. Fleet tools: checks, maps.
`;
```

and before "is deterministic":

```ts
it("leaves the products section out when there are none", () => {
  const readme = renderProfile({ ...fixture, products: [] }).find(
    (item) => item.path === "README.md"
  );
  assert.equal(readme?.contents, expectedRepos);
});
```

- [ ] **Step 2: Run it to verify it fails**: `node --test src/profile/render.test.ts`. Expected: FAIL, 1 of 9: "renders the README exactly" (no `## 2 products` block). The empty-list test already passes.

- [ ] **Step 3: Add the types to `src/profile/types.ts`** as in Interfaces (`ProfileProduct` after `ProfilePerson`; `products` between `personal` and `repos` in `ProfileInput`, between `card` and `profile` in `ProfileStrings`).

- [ ] **Step 4: Implement the section in `src/profile/readme.ts`** (`import type { ProfileInput, ProfileProduct } from "./types.ts";`):
  - `const countHeading = (count: number, forms: { headingOne: string; headingOther: string }): string` picks `headingOne` when `count === 1`, else `headingOther`, replacing `{count}`; the repo heading uses it too (`countHeading(repos.length, strings.repos)`), replacing today's inline `heading`.
  - `const productLine = (product: ProfileProduct): string` returns `` `- **[${escapeMarkdown(product.name)}](${product.url})** · ${escapeMarkdown(product.meta)}. ${escapeMarkdown(product.line)}` ``.
  - `renderReadme` destructures `products` and, after `...projects`, appends `""`, `## ${countHeading(products.length, strings.products)}`, `""` and the product lines, only when `products.length > 0`.

- [ ] **Step 5: Feed the real products from `src/profile/cli.ts`**: `import { productMeta, products } from "../lib/products.ts";` and pass `products: products.map((product) => ({ line: product.line, meta: productMeta(product), name: product.name, url: product.url }))` to `renderProfile`, between `personal` and `repos`. No reachability check for the product hosts.

- [ ] **Step 6: Run it to verify it passes**: `node --test src/profile/render.test.ts`. Expected: PASS, `ℹ tests 9`, `ℹ fail 0`.

Then `pnpm profile:build`; `tail -4 .profile-out/README.md` prints `## 2 products`, a blank line, `- **[hirista](https://hirista.app)** · Solo founder · 2026. Scores your saved jobs and writes the résumé for each.` and `- **[Safety Real Time](https://safetyrealtime.com)** · Co-founder & CTO · since 2022. Fleet software for trucking: pre-trip checks, live dashboards.`

- [ ] **Step 7: Commit** (run `pnpm fix` first; the hook runs `pnpm check`, which ends with `node src/profile/cli.ts --check`)

```bash
git add src/profile/types.ts src/profile/readme.ts src/profile/cli.ts src/profile/fixtures.ts src/profile/render.test.ts
git commit -m "feat(profile): list the products in the README"
```

### Notes from the writers of Task 12

On 2026-10-08 I checked the layout CSS below by injecting it into the live page with Playwright (WebGL off). Results:

- At 1024x768, 1180x820, 1280x720, 1366x768, 1440x900, 1536x864 and 1920x1080 the card height matched the live baseline to the pixel, and the bottoms of the two columns matched.
- 800x1200 and 1000x1200 fit.
- Nothing overflowed from 160 px to 1920 px wide.

Two rules were not part of that run. `text-wrap: balance` was not tested at all. The hide rule was only compiled with the repo's Tailwind 4.3.3.

1. **Fills in CSS, not attributes.** `ProductMark` writes no `fill="var(...)"` attributes. Three CSS rules fill the shapes: `.logo-planet circle`, `.logo-planet [data-ink="mark"]` and `.logo-planet [data-ink="accent"]`. Chrome resolves `var()` in SVG presentation attributes, but no WebKit build is installed here, so Safari could not be checked. CSS rules work in every engine. Task 14 reads `viewBox`, `g[transform]`, `path[d][data-ink]` and `--logo-*` on the span. None of those change.
2. **Name and meta share one row.** The product body has a `div.product-top` that wraps the name link and the meta and becomes one flex row from 40rem. The reason is the height budget. With the meta on its own row, a two-column product tile needs 110.6 px (computed from the tile's CSS values), but only 106.4 px is available at heights up to 823 px, so the card would grow by about 8 px. With one row the tile needs 88.6 px, and the injected test kept every baseline.
3. **Clamp only in two columns.** The 2-line clamp on the product line applies only from `64em`. Below that the line wraps in full. With the clamp inherited from `.repo-desc`, the Safety Real Time line was cut at 200% zoom (640 px) and at 200% text.
4. **Hide rule scoped to screen.** The flat-mark hide rule is `@media screen and (forced-colors: none) { [data-planets="gl"] .logo-planet svg { opacity: 0; } }`. Forced colours and print keep the flat mark, as the spec's fallback list requires. The rule itself is added in Task 14 (merge decision), so the flat marks stay visible between the two commits.

### Task 12: Card strips, product tiles and layout E

**Files:**

- Create: `src/components/card-strips.tsx`, `src/components/product-strip.tsx`, `src/components/product-mark.tsx`
- Modify: `src/components/repo-strip.tsx:6,12,41-62,80,131-132`; `src/app/page.tsx:12,75` (plus the `CardStrips` import); `src/lib/repo-planets.ts:307,346,489,518`; `src/styles/globals.css`. CSS line numbers are at `51dbaf0`; Tasks 5 and 6 shift them, so find each block by its selector. The blocks are `408-412`, `414-421`, `423-436`, `1803-1806`, `1827-1832`, `2280-2283`, a new block after `2347-2352`, and Task 6's `.page-dock` media block.
- Test (outside the repo, never committed): `S=/private/tmp/claude-501/-Users-pavstev-work-website/385f04a6-2dd8-4725-888b-36c85ac6599f/scratchpad`. Shell variables do not persist between tool calls, so start every command that uses `$S` with this assignment. Scripts `$S/card-layout.mjs` and `$S/card-check.mjs`; results `$S/card-live.json`, `$S/card-before.json` and `$S/card-after.json`; close-ups in `$S/card-shots/`.

**Interfaces:**

- Consumes:
  - From Task 7:
    - `@/lib/products`: `interface Product`, `type ProductKey`, `products: readonly Product[]`, `productMeta(product: Product): string`.
    - `@/lib/product-marks`: `productMarks: Record<ProductKey, ProductMark>`. `MarkLayer` stays private, and this component never names a mark type.
    - `@/lib/theme`: `productPalette`.
    - `@/lib/i18n`: `en.products.headingOne` / `headingOther`, plus the existing `en.repos.newTab`.
  - From Task 8: `page.tsx` already has `import { products } from "@/lib/products"`.
  - From Task 6: the `.page-dock` rule and its `@media (min-width: 48em) and (min-height: 45em)` block.
  - From Task 5: the `@custom-variant still` block.
- Produces (Task 14 relies on these):
  - `.card-strips[data-strips]`: the positioned wrapper and the parent of `canvas.repo-planets`. `RepoPlanetsCanvas` stays unchanged and passes it to `initRepoPlanets` as `stage`. `repo-planets.ts` sets and removes `data-planets="gl"` on it.
  - `.logo-planet[data-logo=<ProductKey>]`:
    - An `aria-hidden` span, `width` and `height` `var(--repo-planet-size)`: 2.75rem, or 2.5rem at `(min-width: 48em) and (max-height: 51.4375em)`.
    - Inline `--logo-accent`, `--logo-disc` and `--logo-mark` (hex from `productPalette`).
    - Holds `svg[viewBox]` > `circle` + `g[transform="translate(x y) scale(s)"]` > `path[d][data-ink="mark"|"accent"]`.
  - `.product-tile` is also `.repo-tile`, so the hover and focus listeners find it with `closest(".repo-tile")`. Its `--lang` is `palette.tint`.
  - `transition: opacity 300ms` on `.logo-planet svg`. The screen-only hide rule (note 4) lands in Task 14, together with the GL logos, so the flat marks never vanish in between.

- [ ] **Step 1: Record the baselines before touching any file.**
  - Write `$S/card-layout.mjs <url> <out.json> [shots-dir]`.
  - **Browser:**
    - Import `chromium` from `/Users/pavstev/powertools/node/node_modules/playwright/index.mjs`. The scratchpad has no `node_modules`, so use this absolute path.
    - Launch `{ channel: "chrome", headless: true, args: ["--disable-3d-apis"] }`. This avoids GPU noise and keeps the flat marks visible. Three.js logs "Error creating WebGL context" in this mode; that is expected.
  - **Cases.** Each case is `name: width x height`, with dpr 1 and a 16 px default font unless noted.
    - `W`: 1024x720, 1024x768, 1180x820, 1280x720, 1366x768, 1440x900, 1536x864, 1920x1080
    - `T`: 768x1200, 800x1200, 1000x1200
    - `B`: 768x1024, 820x1180
    - `P`: 320x568, 360x740, 375x667, 390x844, 412x915, 430x932, 667x375, 844x390, 932x430
    - `Z` (200% zoom, dpr 2): z1280 640x360, z1366 683x384, z390 195x422, z320 160x284
    - `X` (200% text): t1280 1280x720, t390 390x844. Create a CDP session and send `Page.setFontSizes { fontSizes: { fixed: 26, standard: 32 } }` before `goto`. This also scales `em` media queries, exactly like the browser's text-size setting.
  - **Per case:**
    - Open a new context with `{ deviceScaleFactor, reducedMotion: "reduce", viewport }`.
    - Run `goto(url, { waitUntil: "load" })`, wait for `document.fonts.ready`, then wait 800 ms.
    - Record these values (px rounded to 0.01):
      - `card`: `[data-card]` `top`, `bottom` and `height`.
      - `footer`: `.card-footer` bottom.
      - `dock`: `.page-dock`, else `.privacy-note`. Its `top` and computed `position`.
      - `main`: `#main-content` bottom.
      - `noScroll`: `<html>` computed `overflow-y` is `hidden`.
      - `hOverflow`: `<html>` `scrollWidth > clientWidth`.
      - `twoColumns`: the `#repos-heading` and `#products-heading` tops are within 1 px of each other.
      - `bottoms`: the bottom of the last `.repo-tile` in `.repo-grid` and in `.product-grid` (`null` when absent).
      - `perRow`: how many `.product-tile` tops are within 1 px of the first one's.
      - `sm`: `matchMedia("(min-width: 40rem)").matches`.
      - `clipped`: the count of `.repo-tile` with `scrollWidth > clientWidth + 0.5`.
      - `cut`: the count of `.product-line` with `scrollHeight > clientHeight + 1`.
      - `canvas`: `canvas.repo-planets` rect equals its parent's rect within 1 px.
  - **Output:** write `{ [case]: record }` to `out.json`. When `shots-dir` is given, also save element screenshots of `.card-strips` for 1024x720, 1280x720, 1920x1080, 1000x1200, 390x844, z1280 and t390.
  - **Run** (the worktree is at Task 11's commit):
    ```bash
    pnpm build
    pnpm exec serve dist -l 4399   # run_in_background; keep it until Step 14
    node $S/card-layout.mjs https://stevanpavlovic.com/ $S/card-live.json
    node $S/card-layout.mjs http://localhost:4399/ $S/card-before.json
    ```
  - **Expected:** `card.height` in both files agrees within 2 px at every `W` size. The live values measured on 2026-10-08:

    | Size      | Card height (px) |
    | --------- | ---------------- |
    | 1024x720  | 640.81           |
    | 1024x768  | 658.81           |
    | 1180x820  | 658.81           |
    | 1280x720  | 640.81           |
    | 1366x768  | 658.81           |
    | 1440x900  | 814.63           |
    | 1536x864  | 750.63           |
    | 1920x1080 | 885.52           |
    | 768x1200  | 866.95           |
    | 800x1200  | 869.52           |
    | 1000x1200 | 885.52           |

    If local and live disagree because the GitHub data changed, `card-before.json` stays the reference. It comes from the same cached GitHub answers as the later build. Note the drift in the report.

- [ ] **Step 2: Slim `RepoStrip`** (`src/components/repo-strip.tsx`).
  - Make the props `interface RepoStripProps { newTabId: string; repos: Repo[] }` and destructure `({ newTabId, repos })`.
  - Delete:
    - the `RepoPlanetsCanvas` import (line 6);
    - `const newTabId` (line 12);
    - the hidden span (lines 53-55);
    - the `div.repo-stage` wrapper and `<RepoPlanetsCanvas />` (lines 62, 131-132), so `ul.repo-grid` follows `.repo-head` directly.
  - The section becomes `<section aria-labelledby="repos-heading" className="strip" data-repos="">`. `fade-up`, `mt-(--card-gap-repos)`, `w-full`, `min-w-0`, `text-left` and `delay-3` move to `CardStrips`. The flex column and gap move to `.strip`.
  - Line 80 keeps `aria-describedby={newTabId}`, which is now the prop.

- [ ] **Step 3: Create `src/components/product-mark.tsx`** (a server component, no `"use client"`).
  - Signature: `export const ProductMark = ({ productKey }: { productKey: ProductKey }): ReactElement`.
  - Read `{ layers, transform, viewBox } = productMarks[productKey]` and `{ accent, disc, mark } = productPalette[productKey]`.
  - Do not import the `ProductMark` type from `product-marks`; its name clashes with this component.
  - Render:
    - Outer: `<span aria-hidden="true" className="logo-planet" data-logo={productKey} style={{ "--logo-accent": accent, "--logo-disc": disc, "--logo-mark": mark } as CSSProperties}>`.
    - Inside it: `<svg focusable="false" viewBox={viewBox}>`.
    - In the svg, first `<circle cx="50%" cy="50%" r="50%" />`. This fills any square viewBox; checked in Chrome, `r` resolves to 12 in `0 0 24 24`.
    - Then ``<g transform={`translate(${String(transform.x)} ${String(transform.y)}) scale(${String(transform.scale)})`}>`` holding one `<path d={layer.d} data-ink={layer.ink} key={layer.d} />` per layer.
  - No `fill` attributes (note 1).

- [ ] **Step 4: Create `src/components/product-strip.tsx`** (server).
  - Signature: `export const ProductStrip = ({ newTabId, products }: ProductStripProps): null | ReactElement`, with `ProductStripProps { newTabId: string; products: readonly Product[] }`.
  - Return `null` for an empty list.
  - Add a local `headingFor(count)` that works like `RepoStrip`'s: `Intl.PluralRules("en")`, `en.products.headingOne` / `headingOther`, `.replace("{count}", () => String(count))`.
  - Markup:
    - `<section aria-labelledby="products-heading" className="strip" data-products="">`.
    - Inside it, `div.repo-head.text-halo`. It holds `<h2 className="repo-heading type-eyebrow" id="products-heading">` and `<span aria-hidden="true" className="repo-rule" />`.
    - Then `<ul className="product-grid">`, with one `<li className="min-w-0" key={product.key}>` per product.
    - Each `li` holds `<div className="repo-tile product-tile" data-pointer-light="" style={{ "--lang": product.palette.tint } as CSSProperties}>`.
    - In the tile, `<ProductMark productKey={product.key} />`, then `div.repo-body`.
    - `div.repo-body` holds:
      - `div.product-top`, which wraps the link ``<a aria-describedby={`${newTabId} product-line-${product.key}`} className="repo-name repo-link" href={product.url} rel="noopener noreferrer" target="_blank">{product.name}</a>`` and `<span className="product-meta">{productMeta(product)}</span>`;
      - then ``<p className="repo-desc product-line" id={`product-line-${product.key}`}>{product.line}</p>``.

- [ ] **Step 5: Create `src/components/card-strips.tsx`** (server).
  - Add `const newTabId = "strips-new-tab";`.
  - Signature: `export const CardStrips = ({ products, repos }: CardStripsProps): ReactElement`, with `CardStripsProps { products: readonly Product[]; repos: Repo[] }`.
  - Render `<div className="card-strips fade-up mt-(--card-gap-repos) w-full min-w-0 text-left delay-3" data-strips="">` holding, in this order:
    - `<span hidden id={newTabId}>{en.repos.newTab}</span>`;
    - `<RepoStrip newTabId={newTabId} repos={repos} />`;
    - `<ProductStrip newTabId={newTabId} products={products} />`;
    - `<RepoPlanetsCanvas />`. It goes last, so the canvas's `parentElement` is the wrapper. DOM, focus and reading order: repos, then products, at every width.

- [ ] **Step 6: Mount it in `src/app/page.tsx`.**
  - Add `import { CardStrips } from "@/components/card-strips";`.
  - Remove the `RepoStrip` import (line 12).
  - Replace `<RepoStrip repos={repos} />` (line 75 at `51dbaf0`; Task 8's import shifts it) with `<CardStrips products={products} repos={repos} />`.

- [ ] **Step 7: Put `data-planets` on the stage** (`src/lib/repo-planets.ts`).
  - Delete line 307 (`const section = stage.closest<HTMLElement>("[data-repos]");`).
  - Line 346 becomes `stage.setAttribute("data-planets", "gl");`.
  - Lines 489 and 518 become `stage.removeAttribute("data-planets");`.
  - Nothing else changes here; Task 14 adds the logo nodes.

- [ ] **Step 8: Static checks.**

  ```bash
  pnpm exec prettier --write src/components/card-strips.tsx src/components/product-strip.tsx src/components/product-mark.tsx src/components/repo-strip.tsx src/app/page.tsx src/lib/repo-planets.ts
  pnpm exec eslint --fix --max-warnings=0 src/components/card-strips.tsx src/components/product-strip.tsx src/components/product-mark.tsx src/components/repo-strip.tsx src/app/page.tsx src/lib/repo-planets.ts
  pnpm exec tsc --noEmit
  ```

  Expected: exit 0 and no findings. Prettier sorts the class lists, and ESLint sorts the JSX props and the imports (perfectionist).

- [ ] **Step 9: CSS, the no-scroll gate** (`src/styles/globals.css`).
  - Directly under Task 5's `@custom-variant still`, add `@custom-variant no-scroll { @media (min-width: 64em) and (min-height: 45em), (min-width: 48em) and (min-height: 75em) { @slot; } }`. Use the block form only. Checked with the repo's Tailwind 4.3.3: the comma list comes out intact.
  - **`html` (lines 408-412):** replace `@media (min-width: 48em) and (min-height: 45em) { html { overflow: hidden; } }` with `html { @variant no-scroll { overflow: hidden; } }`.
  - **`#main-content` (lines 428-436):** delete the media block. Put its two declarations unchanged, `min-height: 100dvh` and `padding-bottom: max(var(--safe-y, 2.5rem), calc(var(--privacy-zone) + 1rem))`, into `@variant no-scroll { }` at the end of the base `#main-content` rule (lines 423-426).
  - **`.page-dock` (Task 6's block, formerly `.privacy-note` at lines 3200-3206):** delete the media block. Put its declarations unchanged into `@variant no-scroll { }` at the end of the base `.page-dock` rule.
  - The `max-height` tiers (438, 444, 463, 483, 2280, 2295) stay as they are.
  - Check: `grep -c "(min-width: 48em) and (min-height: 45em)" src/styles/globals.css` prints `0`.

- [ ] **Step 10: CSS, card width and stacked strips.**
  - **After `[data-card]` (lines 414-421):** add `@media (min-width: 64em) { [data-card] { --container-page-max: 68rem; } }`. The profile block keeps its widths, because the bio keeps `max-w-xl` and its own `44rem` tier.
  - **Replace `.repo-stage` (lines 1803-1806) with:**
    - `.card-strips { position: relative; display: flex; flex-direction: column; gap: var(--card-gap-repos); }`
    - `.strip { display: flex; flex-direction: column; gap: var(--card-gap-strip); min-width: 0; }`
  - **After `.repo-grid` (lines 1827-1832):** add `.product-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--repo-row-gap, 0.625rem); min-width: 0; }`.
  - **Lines 2280-2283:** change the selector `.repo-grid` to `.repo-grid, .product-grid`. Both lists then use the 0.5rem gap below 1000 px tall, and each product tile is exactly half the repo list minus one gap: 106.44 px at 1280x720.
  - Leave `[data-planets="gl"] .repo-planet` (line 1823) and the print rules as they are. The descendant selector still matches once the stage carries the attribute.

- [ ] **Step 11: CSS, product tiles, flat marks and the two columns.** Add one block after the repo `@media (forced-colors: active)` block (lines 2347-2352). The order matters: these rules must come after the `.repo-*` tiers so they win at equal specificity.
  1. `.product-tile { --repo-planet-size: 2.75rem; }`
  2. `.logo-planet { display: block; grid-area: 1 / 1; width: var(--repo-planet-size); height: var(--repo-planet-size); forced-color-adjust: none; }`
  3. `.logo-planet svg { display: block; width: 100%; height: 100%; border-radius: 9999px; box-shadow: 0 0 0 1px color-mix(in oklab, var(--lang) 40%, transparent), 0 0 1.25rem color-mix(in oklab, var(--lang) 16%, transparent); transition: opacity 300ms var(--ease-smooth); }`. This copies `.repo-planet`'s ring and glow. They sit on the svg so they hide with it, and the ring keeps the near-black hirista disc visible.
  4. `.logo-planet circle { fill: var(--logo-disc); }`, `.logo-planet [data-ink="mark"] { fill: var(--logo-mark); }`, `.logo-planet [data-ink="accent"] { fill: var(--logo-accent); }`
  5. (No hide rule here: Task 14 adds `@media screen and (forced-colors: none) { [data-planets="gl"] .logo-planet svg { opacity: 0; } }`.)
  6. `.product-top { display: contents; }` and `.product-meta { grid-column: 1 / -1; color: var(--muted-foreground); font-size: 0.8125rem; line-height: 1.25rem; text-wrap: balance; }`. On phones: logo and name on row 1, meta and line at full width below, like the repo tiles. `balance` stops "since 2022" from splitting.
  7. `@media (min-width: 40rem)` holds:
     - `.product-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }`
     - `.product-top { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 0.75rem; min-width: 0; }`
     - `.product-meta { grid-column: auto; }`
     - `.product-line { display: block; overflow: visible; -webkit-line-clamp: none; line-clamp: none; }`
  8. `@media (min-width: 48em) and (max-height: 51.4375em) { .product-tile { --repo-planet-size: 2.5rem; } }`
  9. `@media (min-width: 64em)` holds:
     - `.card-strips { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: auto 1fr; gap: var(--card-gap-strip) 1.5rem; }`
     - `.strip { display: grid; grid-row: span 2; grid-template-rows: subgrid; }`
     - `.product-grid { grid-template-columns: minmax(0, 1fr); grid-auto-rows: 1fr; }`
     - `.product-line { display: -webkit-box; overflow: hidden; -webkit-line-clamp: 2; line-clamp: 2; }`

     `-webkit-box-orient: vertical` comes from `.repo-desc`. The headings share row 1 and the lists share row 2. The repo list sets the height, because `1fr` rows size to the taller tile and 88.6 px fits in 106.4 px.

- [ ] **Step 12: Build and check the output.**

  ```bash
  pnpm exec prettier --write src/styles/globals.css && pnpm build
  grep -o 'data-strips=""' dist/index.html | wc -l                                          # 1
  grep -o 'class="logo-planet"' dist/index.html | wc -l                                     # 2
  grep -o 'data-ink="mark"' dist/index.html | wc -l                                         # 7 (1 hirista + 6 Safety Real Time)
  grep -o 'data-ink="accent"' dist/index.html | wc -l                                       # 1
  grep -o 'aria-describedby="strips-new-tab product-line-[a-z-]*"' dist/index.html | wc -l  # 2
  grep -o -E 'repos-new-tab|repo-stage' dist/index.html | wc -l                             # 0
  node -e 'const h=require("node:fs").readFileSync("dist/index.html","utf8");const a=["data-strips","data-repos","data-products","class=\"repo-planets\""].map((s)=>h.indexOf(s));console.log(a.every((v,i)=>v>0&&(i===0||v>a[i-1])))'  # true
  cat dist/_next/static/chunks/*.css | grep -o -F '(min-width:48em) and (min-height:45em)' | wc -l   # 0
  cat dist/_next/static/chunks/*.css | grep -o -F '(min-width:48em) and (min-height:75em)' | wc -l   # 3 (html, #main-content, .page-dock)
  cat dist/_next/static/chunks/*.css | grep -o -F '[data-planets=gl] .logo-planet svg' | wc -l       # 0 (Task 14 adds it)
  cat dist/_next/static/chunks/*.css | grep -o -F ':scope' | wc -l                                   # 0
  ```

  If the second-to-last count is below 3, one of the three rules lost its variant or kept the old query.

- [ ] **Step 13: Browser proof.**
  - The build replaced `dist`, so stop the Step 1 server (`pkill -f "serve dist -l 4399"`) and start `pnpm exec serve dist -l 4399` again in the background.
  - Run `node $S/card-layout.mjs http://localhost:4399/ $S/card-after.json $S/card-shots`.
  - Write `$S/card-check.mjs <after.json> <before.json>`. It prints one `PASS`/`FAIL` line per case and rule and exits 1 on any `FAIL`. The rules (`base` is the baseline record; `dock.position` is the dock's computed `position`):
    - **Every case:** `!hOverflow`, `clipped === 0`, `cut === 0` and `canvas`.
    - **`W` cases:**
      - `|card.height - base.card.height| <= 2`;
      - `twoColumns`;
      - `|bottoms[0] - bottoms[1]| <= 1`;
      - `perRow === 1`;
      - `noScroll`;
      - `dock.position === "fixed"`;
      - `card.top >= 0`;
      - `footer <= dock.top`.
    - **`T` cases** (800x1200 and 1000x1200 fit and the footer clears the dock):
      - `!twoColumns`;
      - `perRow === 2`;
      - `noScroll`;
      - `dock.position === "fixed"`;
      - `card.top >= 0`;
      - `footer <= dock.top`.
    - **`B`, `P`, `Z` and `X` cases:**
      - `!twoColumns`;
      - `!noScroll`;
      - `dock.position !== "fixed"`;
      - `dock.top >= main - 0.5`, so the dock sits after `main`;
      - `perRow === (sm ? 2 : 1)`.

      So phones from 320 to 430 px show one product per row. 768x1024, 820x1180, the landscape phones, z1280, z1366 and t1280 show two per row and scroll.
  - Run `node $S/card-check.mjs $S/card-after.json $S/card-before.json`. Expected: exit 0, every line `PASS`.

- [ ] **Step 14: Close-ups and regressions.**
  - Open each PNG in `$S/card-shots/` with Read and check:
    - hirista shows a cream bar and an orange hook on the near-black disc, with an orange ring.
    - Safety Real Time shows a navy truck centred on the green disc.
    - In two columns, both headings sit on one row, name and meta sit on one row, and both lists end on the same line.
    - In the stacked layout, products sit two per row and the meta never splits "since 2022".
    - No text is cut or outside a tile.
  - Run `node ~/powertools/scripts/website-card-e2e.mjs http://localhost:4399/`. Expected: every line `PASS`. It runs with the GPU, so the flat marks fade once the repo canvas draws (note 4).
  - Run axe twice. Expected: `0 violations` both times.
    ```bash
    node ~/powertools/scripts/axe-check.mjs http://localhost:4399/ task12-1280 1280 720
    node ~/powertools/scripts/axe-check.mjs http://localhost:4399/ task12-390 390 844
    ```
  - Stop the server: `pkill -f "serve dist -l 4399"`.

- [ ] **Step 15: Commit**
  ```bash
  git status --short
  git add src/components/card-strips.tsx src/components/product-strip.tsx src/components/product-mark.tsx src/components/repo-strip.tsx src/app/page.tsx src/lib/repo-planets.ts src/styles/globals.css
  git commit -m "feat(card): add the products column (layout E) and a new no-scroll gate"
  ```
  Expected: `git status --short` lists only these seven files, and `.env.local` is never staged. husky runs `pnpm check` and the commit lands.

### Notes from the writers of Tasks 13 and 14

1. `src/lib/logo-planet.ts` exports only `createLogoPlanet` and `type LogoPlanet`. `drawLogoMask` and `LogoUniforms` keep the contract names and shapes but stay module-local. knip runs with `ignoreExportsUsedInFile: false`, so it reports a value export used only in its own file, and an exported type used only as a member of another export. I checked this with the repo's knip on a scratch probe. Types that appear in an exported signature (`LogoInput`, `LogoMotion`, `LogoPlanet`) are not reported.
2. `LogoUniforms` gains `uTint: { value: Color }`, read from the inherited `--lang` (the product tile sets it to `palette.tint`). The spec says the tint drives the rim glow, and neither `uDisc` nor `uAccent` equals the tint for both products.
3. Only its test uses `logoMotionConfig`, so the test must import it. The first test pins its values. Without that import, knip fails the Task 13 commit.
4. (Applied to Review Focus.) A hidden tab or an off-screen stage does not settle the sunrise. The contract settles only for reduced motion, a held or paused scene, and a freeze. In the other cases the loop restarts and the sunrise finishes, so the logo cannot stick on the night side. The Review Focus line "Tab hidden ... snaps to the rest pose" should say "resumes and finishes" for the Task 15 check.
5. (Resolved: the rule is scoped to `@media screen and (forced-colors: none)` and lands in Task 14.) For Task 12: `[data-planets="gl"] .logo-planet svg` also matches in print and forced colours. There `.repo-planets` is `display: none` but the attribute stays, so the logos vanish. Task 12 needs `.logo-planet svg { opacity: 1 }` inside `@media print` and `@media (forced-colors: active)`. The same rule also hides the flat logos, with no GL logo drawn, between the Task 12 and Task 14 commits. Nothing ships in between, so this only matters for bisecting.

### Task 13: Logo motion math

**Files:**

- Create: `src/lib/logo-motion.ts`
- Test: `src/lib/logo-motion.test.ts`

**Interfaces:**

- Consumes: nothing (pure module, no imports).
- Produces (contract, used by Task 14):
  - `export const logoMotionConfig = { hotAmplitude: 0.5, hotSpeed: 3.4, hotTauMs: 140, sunriseFrom: -1.9, sunriseMs: 2400, wobbleAmplitude: 0.35, wobblePeriodMs: 9000 } as const;`
  - `export interface LogoInput { hotGoal: number; started: boolean; }`
  - `export interface LogoMotion { readonly elapsedMs: number; readonly hot: number; readonly phase: number; }` (`elapsedMs < 0` means the sunrise has not started)
  - `export const createLogoMotion = (): LogoMotion`
  - `export const stepLogoMotion = (state: LogoMotion, dtMs: number, input: LogoInput): LogoMotion`
  - `export const settleLogoMotion = (state: LogoMotion): LogoMotion`
  - `export const logoSpin = (state: LogoMotion): number` (radians, written to the shader's `uSpin`)

- [ ] **Step 1: Write the failing test.** Create `src/lib/logo-motion.test.ts` with exactly this content. It passed against a reference implementation of Step 3, under the repo's `tsc`, ESLint and Prettier settings:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createLogoMotion,
  type LogoInput,
  type LogoMotion,
  logoMotionConfig,
  logoSpin,
  settleLogoMotion,
  stepLogoMotion,
} from "./logo-motion.ts";

const frameMs = 33;
const seen: LogoInput = { hotGoal: 0, started: true };
const unseen: LogoInput = { hotGoal: 0, started: false };
const hover: LogoInput = { hotGoal: 1, started: true };

const run = (totalMs: number, dtMs: number, input: LogoInput): LogoMotion => {
  let state = createLogoMotion();
  for (let time = 0; time < totalMs; time += dtMs) {
    state = stepLogoMotion(state, dtMs, input);
  }
  return state;
};

const lcg = (seed: number): (() => number) => {
  let value = seed;
  return () => {
    value = (Math.imul(value, 1_664_525) + 1_013_904_223) >>> 0;
    return value / 4_294_967_296;
  };
};

describe("logo motion", () => {
  it("keeps the spec numbers", () => {
    assert.deepEqual(logoMotionConfig, {
      hotAmplitude: 0.5,
      hotSpeed: 3.4,
      hotTauMs: 140,
      sunriseFrom: -1.9,
      sunriseMs: 2400,
      wobbleAmplitude: 0.35,
      wobblePeriodMs: 9000,
    });
  });

  it("starts on the night side", () => {
    assert.equal(logoSpin(createLogoMotion()), -1.9);
  });

  it("stays on the night side until it is seen", () => {
    assert.equal(logoSpin(run(1000, frameMs, unseen)), -1.9);
  });

  it("turns in by at most 0.15 rad per 33 ms frame", () => {
    let state = createLogoMotion();
    let spin = logoSpin(state);
    for (let time = 0; time < 2900; time += frameMs) {
      state = stepLogoMotion(state, frameMs, seen);
      const next = logoSpin(state);
      assert.ok(
        Math.abs(next - spin) <= 0.15,
        `${String(spin)} to ${String(next)}`
      );
      spin = next;
    }
  });

  it("rests at exactly 0 rad when the sunrise ends", () => {
    assert.equal(logoSpin(run(2400, 100, seen)), 0);
  });

  it("wobbles within 0.5 rad after the sunrise, hovered or not", () => {
    const random = lcg(7);
    let state = run(2400, 100, seen);
    for (let index = 0; index < 2000; index += 1) {
      const input = { hotGoal: random() < 0.5 ? 0 : 1, started: true };
      state = stepLogoMotion(state, random() * 100, input);
      const spin = logoSpin(state);
      assert.ok(Math.abs(spin) <= 0.5 + 1e-12, String(spin));
    }
  });

  it("settles to the rest pose", () => {
    const fresh = settleLogoMotion(createLogoMotion());
    const midway = settleLogoMotion(run(1200, frameMs, seen));
    assert.equal(logoSpin(fresh), 0);
    assert.equal(logoSpin(midway), 0);
  });

  it("changes nothing without time", () => {
    const fresh = createLogoMotion();
    assert.deepEqual(stepLogoMotion(fresh, 0, hover), fresh);
    const midway = run(1200, frameMs, seen);
    assert.deepEqual(stepLogoMotion(midway, 0, hover), midway);
  });

  it("eases the hover glow in within a second", () => {
    const { hot } = run(1000, 100, { hotGoal: 1, started: false });
    assert.ok(hot > 0.99, String(hot));
  });
});
```

- [ ] **Step 2: Run it to verify it fails.** `node --test src/lib/logo-motion.test.ts` stops with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../src/lib/logo-motion.ts' imported from .../src/lib/logo-motion.test.ts` and `ℹ fail 1`.

- [ ] **Step 3: Implement** `src/lib/logo-motion.ts` with the signatures above. Declare `LogoInput` before `LogoMotion`, because perfectionist sorts module members. Approach: one immutable state, an eased hover value, and a clamped sunrise clock whose overflow drives the wobble phase.
  - `createLogoMotion()` returns `{ elapsedMs: -1, hot: 0, phase: 0 }`.
  - `stepLogoMotion`:
    - `dtMs <= 0` returns `state` unchanged.
    - `hot = state.hot + (hotGoal - state.hot) * (1 - Math.exp(-dtMs / hotTauMs))`.
    - While `!started && state.elapsedMs < 0`, return `{ ...state, hot }`.
    - Otherwise set `from = Math.max(state.elapsedMs, 0)` and `elapsedMs = Math.min(from + dtMs, sunriseMs)`. The overflow `from + dtMs - elapsedMs` advances `phase` by `2π · overflow / wobblePeriodMs · (1 + (hotSpeed - 1) · hot)`. Keep the phase below `2π` with `%`.
    - Once `elapsedMs >= 0`, `started` is ignored, so a sunrise finishes even after the logo leaves the view.
  - `settleLogoMotion` returns `{ ...state, elapsedMs: sunriseMs, phase: 0 }`.
  - `logoSpin`:
    - `elapsedMs < 0` gives `sunriseFrom`.
    - `elapsedMs < sunriseMs` gives `sunriseFrom * (1 - elapsedMs / sunriseMs) ** 3`, which equals `sunriseFrom · (1 - easeOutCubic(t))`.
    - Otherwise it gives `(wobbleAmplitude + (hotAmplitude - wobbleAmplitude) * hot) * Math.sin(phase)`.
    - Keep the second `<` strict. At exactly `sunriseMs` the sunrise branch would return `-0`, and `assert.equal(-0, 0)` fails because strict assert uses `Object.is`.

- [ ] **Step 4: Run it to verify it passes.** `node --test src/lib/logo-motion.test.ts` prints `ℹ tests 9`, `ℹ pass 9`, `ℹ fail 0`. Run `pnpm exec prettier --write src/lib/logo-motion.ts src/lib/logo-motion.test.ts`. Then each of these must exit 0: `pnpm exec eslint src/lib/logo-motion.ts src/lib/logo-motion.test.ts --max-warnings=0`, `pnpm exec tsc --noEmit`, `pnpm exec knip`.

- [ ] **Commit.** `git add src/lib/logo-motion.ts src/lib/logo-motion.test.ts` then `git commit -m "feat(planets): add the logo sunrise and wobble motion"` (husky runs `pnpm check`).

### Task 14: Logo planets in the planets canvas

**Files:**

- Create: `src/lib/logo-planet.ts`
- Modify: `src/lib/repo-planets.ts`. Line numbers are at `51dbaf0`, before Task 12 replaces `section` with `stage`:
  - imports 1-18
  - `planetVertex` 83-94 and `planetFragment` 96-118 (`vView`)
  - node collection 208-212 and setup 218-223
  - `place` 321-334, `advance` 349-372, `loop` 390-404, `sync` 406-420
  - hover listeners 441-466 and `dispose` 505-520
- Test, outside the repo: `/private/tmp/claude-501/-Users-pavstev-work-website/385f04a6-2dd8-4725-888b-36c85ac6599f/scratchpad/logo-planets-check.mjs`. There is no unit test, because WebGL, `Path2D` and `getComputedStyle` do not run under `node --test`.

**Interfaces:**

- Consumes:
  - Task 13: `createLogoMotion`, `stepLogoMotion`, `settleLogoMotion`, `logoSpin`, `type LogoMotion`.
  - Task 1: `isSceneHeld()`, true when the scene is held or paused.
  - Task 12 markup: `span.logo-planet[data-logo]` sits inside `.repo-tile.product-tile`, which sets `--lang` to `palette.tint`. The span carries inline `--logo-disc`, `--logo-mark` and `--logo-accent`, and holds `svg[viewBox] > circle + g[transform] > path[data-ink]`.
  - Task 12 stage: `draw()` sets `data-planets="gl"` on `.card-strips`, the canvas parent. The CSS hides `.logo-planet svg` under that attribute with a 300 ms fade.
- Produces:
  - `export interface LogoPlanet { dispose: () => void; group: Group; node: HTMLElement; uniforms: LogoUniforms; }`
  - `export const createLogoPlanet = (node: HTMLElement, sphere: SphereGeometry, renderer: WebGLRenderer, time: { value: number }): LogoPlanet`
  - Module-local, imported by nothing: `interface LogoUniforms` (the contract members plus `uTint: { value: Color }`) and `const drawLogoMask = (svg: SVGSVGElement, size: number): HTMLCanvasElement`.

- [ ] **Step 1: Write the browser check** `logo-planets-check.mjs`, run as `node logo-planets-check.mjs <url> <label>`.
  - Import with `import { chromium } from "/Users/pavstev/powertools/node/node_modules/playwright/index.mjs";`.
  - Launch with `{ channel: "chrome", headless: true, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] }`. Without these flags headless Chrome uses SwiftShader, `isSoftwareRenderer` rejects it, and nothing draws.
  - Every context uses `viewport: { width: 390, height: 844 }` and `deviceScaleFactor: 2`, unless a step says otherwise. Record page errors and console `error` messages.
  - `shoot(page, key)` takes an element screenshot of `.logo-planet[data-logo="<key>"]` and saves it next to the script as `logo-<key>-<step>-<label>.png`.
  - `pixels(png)` decodes the PNG in a separate `about:blank` page (`createImageBitmap` of the blob, `OffscreenCanvas` 2D, `getImageData`). It returns the luminance `0.2126 r + 0.7152 g + 0.0722 b` of the pixels within `0.4 * width` of the centre.
  - `match(a, b)` is the Pearson correlation of two such arrays, or `0` when either has no variance. `still(a, b)` is their mean absolute difference. Both throw when the two PNGs differ in size.
  - Ready gate for every JS context: wait up to 20 s for `.card-strips[data-planets="gl"]`, then 1000 ms. Then print `UNMASKED_RENDERER_WEBGL` from the existing `webgl2` context of `canvas.repo-planets`.
  - Flat reference F: a context with `javaScriptEnabled: false` and `reducedMotion: "reduce"`. Load, wait 1 s, and shoot both keys.
  - Checks, each printing `PASS` or `FAIL <name> <numbers>`:
    1. `fallback hidden`: in motion context M after the ready gate, every `.logo-planet svg` has computed `opacity` `"0"`.
    2. `rest <key>`: in a `reducedMotion: "reduce"` context, pass the ready gate and shoot R. Pass when `match(R, F) >= 0.4`. A reference render measured 0.92 for hirista and 0.52 for Safety Real Time. A mirrored, flipped or missing logo scores 0.03 or below.
    3. `context loss`: on the same page, call `document.querySelector("canvas.repo-planets").getContext("webgl2").getExtension("WEBGL_lose_context").loseContext()` and wait 600 ms. Pass when `.card-strips` has no `data-planets` and every `.logo-planet svg` has `opacity` `"1"`.
    4. `sunrise <key>`: in M, the products are below the fold at the ready gate. Run `document.querySelector("[data-products]").scrollIntoView({ block: "center", behavior: "instant" })`. Shoot S1 300 ms after the scroll and S2 2300 ms after it. Pass when `match(S1, F) <= 0.15` and `match(S2, F) >= 0.4`. At 2.3 s the ease-out is within 0.005 rad of rest and the wobble has not started. At 3 s the logo is about 0.13 rad off, which drops Safety Real Time's thin lines to about 0.28.
    5. `pause snaps <key>`: reload M, pass the ready gate, and scroll as in check 4. After 300 ms run `document.documentElement.setAttribute("data-motion-paused", ""); dispatchEvent(new Event("scene:hold"))`. Shoot P 400 ms later and P2 1500 ms after that. Pass when `match(P, F) >= 0.4` and `still(P, P2) <= 1`.
    6. `no errors`: no page or console errors in any context.
  - Save `repo-grid-<label>.png` from a 1280x860 `reducedMotion: "reduce"` context after the ready gate, with `locator(".repo-grid").screenshot()`. That context draws one still frame, so the `before` and `after` images differ only by the shader.
  - Exit with code 1 when any check fails.

- [ ] **Step 2: Run it to verify it fails.** In the worktree, start `pnpm dev` in the background; it serves `http://localhost:4321`. If that port is taken, run `node scripts/cv-fetch.ts && pnpm exec next dev -p 4322` and use that URL. Then run `node /private/tmp/claude-501/-Users-pavstev-work-website/385f04a6-2dd8-4725-888b-36c85ac6599f/scratchpad/logo-planets-check.mjs http://localhost:4321 before`.
  - Expected PASS: `fallback hidden` (from the Task 12 CSS) and `context loss`.
  - Expected FAIL, with `match` near 0 because no GL logo is drawn: `rest hirista`, `rest safety-real-time`, both `sunrise` checks and both `pause snaps` checks.
  - Expected exit code 1. Keep `repo-grid-before.png`.

- [ ] **Step 2a: Add the hide rule** (moved here from Task 12) to `src/styles/globals.css`, right after the `.logo-planet` rules: `@media screen and (forced-colors: none) { [data-planets="gl"] .logo-planet svg { opacity: 0; } }`. Print and forced colours keep the flat marks. After `pnpm build`, `cat dist/_next/static/chunks/*.css | grep -o -F '[data-planets=gl] .logo-planet svg' | wc -l` prints `1`. Add `src/styles/globals.css` to this task's commit.

- [ ] **Step 3: Types and mask** in `src/lib/logo-planet.ts`, importing from `three` only. Write `LogoUniforms` (`[uniform: string]: { value: unknown }`, `uAccent`, `uDisc`, `uHot`, `uMark`, `uMask: { value: CanvasTexture }`, `uSpin`, `uTime`, `uTint`) and the exported `LogoPlanet`. Then `drawLogoMask(svg, size)`:
  - Create a `size` by `size` canvas the way `createCanvas` in `city-globe.ts:149-159` does. Throw when `getContext("2d")` is null.
  - Throw when `svg.viewBox.baseVal` has no width or height, when `svg.querySelectorAll<SVGPathElement>("path[data-ink]")` is empty, or when a path has no `d`.
  - First fill the whole canvas with `"rgb(0,0,0)"`. It must be opaque: transparent edge pixels are un-premultiplied on upload into full-strength ink, which aliases the mark.
  - Set `globalCompositeOperation = "lighter"`.
  - Call `setTransform(new DOMMatrix().scale(size / box.width, size / box.height).translate(-box.x, -box.y).multiply(matrix))`, where `matrix` is `svg.querySelector("g")?.transform.baseVal.consolidate()?.matrix ?? new DOMMatrix()`. Path2D ignores ancestor transforms, so this applies the `<g>` transform by hand.
  - Fill each path with `new Path2D(d)`: `data-ink="mark"` in `"rgb(255,0,0)"`, `"accent"` in `"rgb(0,255,0)"`. Use `rgb()` strings like `maskColors` (`city-globe.ts:96-100`), because hex colours are not allowed outside `theme.ts`.

- [ ] **Step 4: Logo shaders** as module constants in `logo-planet.ts`.
  - `logoVertex` is the repo `planetVertex` without `vView`. It sets `vObj = position` and `vNormal = normalize(normalMatrix * normal)`.
  - `logoFragment` declares `uDisc`, `uMark`, `uAccent`, `uTint` (vec3), `uMask` (sampler2D) and `uSpin`, `uHot`, `uTime` (float).
  - It reuses the spin from `planetFragment` (`repo-planets.ts:110-113`: `p = normalize(vObj)` and `q = vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z)`).
  - It reuses the planet lighting terms with the fixed view vector:
    - `n = normalize(vNormal)` and `v = vec3(0.0, 0.0, 1.0)`
    - `sun = normalize(vec3(-0.6, 0.55, 0.58))` and `ndl = dot(n, sun)`
    - `day = smoothstep(-0.18, 0.55, ndl)` and `terminator = smoothstep(0.22, 0.0, abs(ndl - 0.05))`
    - `facing = max(dot(n, v), 0.0)`, then `rim = pow(1.0 - facing, 2.6) * (0.82 + 0.18 * sin(uTime * 1.4))` (no seed)
    - `specular = pow(max(dot(reflect(-sun, n), v), 0.0), 34.0)`
  - It ends with `#include <colorspace_fragment>`.
  - The logo-specific part:

    ```glsl
    vec4 ink = texture2D(uMask, q.xy * 0.5 + 0.5);
    float front = smoothstep(0.0, 0.15, q.z);
    vec3 base = mix(uDisc, uMark, ink.r * front);
    base = mix(base, uAccent, ink.g * front);
    vec3 lit = base * (0.85 + 0.25 * max(ndl, 0.0));
    vec3 col = mix(base * 0.1, lit, day);
    col += uTint * terminator * 0.12;
    col += mix(base * 0.1, uTint, day * 0.6 + 0.4) * rim * (1.1 + 0.8 * uHot);
    col += vec3(1.0) * specular * 0.22 * day;
    col += uTint * 0.1 * uHot;
    gl_FragColor = vec4(col, 1.0);
    ```

  - Why these values, as checked on a GPU render:
    - In `uv = q.xy * 0.5 * k + 0.5`, `k = 1`. The mask spans the viewBox and the disc art is inscribed in it, so the disc covers the front hemisphere exactly. The logo centre sits at `q = (0, 0, 1)`.
    - At spin 0 the orthographic camera shows `q.xy` as screen x and y. So the printed logo lines up with the flat SVG when the sphere radius is half the slot (Step 6).
    - `front` removes the back hemisphere. Without it, `q.xy` prints a mirrored copy that sits on the lit left limb at spin -1.9. The soft edge lies where there is no ink, because the marks stay above `q.z = 0.5`.
    - Ink is used as coverage, not thresholded, because the mask is drawn 3 to 6 times smaller on screen. Accent mixes over mark.
    - The night side is `base * 0.1`. The cream "h" stays faintly visible, and the navy truck reads as a dark shape on dim green.
    - `lit` is about `1.0 * base` at the logo centre at rest (`ndl` is 0.58 there), so the brand colours hold.
    - Leave `flipY` at its default `true`, so the top of the canvas maps to `q.y = 1`.

- [ ] **Step 5: `createLogoPlanet`**.
  - Do everything that can throw before creating any three object:
    - Read `node.querySelector("svg")` and throw when it is null.
    - Read `--logo-disc`, `--logo-mark`, `--logo-accent` and the inherited `--lang` from `getComputedStyle(node)`. Throw unless each trimmed value starts with `#`. Build each with `new Color(value)`, which converts sRGB to linear like `readColor` does.
    - Call `drawLogoMask(svg, 256)`.
  - Create the texture as in `city-globe.ts:452-460`: `new CanvasTexture(mask)`, `colorSpace = NoColorSpace`, `anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())`, `minFilter = LinearMipmapLinearFilter`.
  - Start `uSpin` and `uHot` at 0. Set `uTime: time`, the shared object, never a copy.
  - Create one `new ShaderMaterial({ fragmentShader: logoFragment, uniforms, vertexShader: logoVertex })`. Add `new Mesh(sphere, material)` to a `new Group()`, with no tilt.
  - `dispose` frees only the texture and the material. The caller owns `sphere`.

- [ ] **Step 6: Create the logo planets** in `initRepoPlanets`, still in `repo-planets.ts`.
  - Import `createLogoPlanet, type LogoPlanet` from `@/lib/logo-planet` and the Task 13 functions from `@/lib/logo-motion` (alias imports, like the rest of this client module).
  - Next to `nodes`, collect `logoNodes` from `.logo-planet`. Throw `"no planets"` only when both lists are empty.
  - Add constants `logoScale = 0.5`, so the sphere is exactly the slot and replaces the flat disc like for like, and `sunriseVisibility = 0.6`.
  - Add `interface LogoState { hotGoal: number; inView: boolean; motion: LogoMotion; node: HTMLElement; planet: LogoPlanet; }`.
  - Right after `timeUniform`, build `logos: LogoState[]` inside `try { ... } catch (error) { renderer.dispose(); throw error; }`. A colour or mask failure then falls back to CSS without leaking the context; three objects hold no GPU memory before the first render.
  - Each logo is `{ hotGoal: 0, inView: false, motion: createLogoMotion(), node, planet }`, with `scene.add(planet.group)`.

- [ ] **Step 7: Place and step them.**
  - Move the per-node body of `place()` into `placeAt(group, node, scale, origin)`. Repo planets pass `bodyScale * (1 + planet.hot * 0.07)`; logos pass `logoScale * (1 + logo.motion.hot * 0.07)`.
  - In `advance(dt)`, after the planet loop, for each logo:
    - `logo.motion = stepLogoMotion(logo.motion, dt, { hotGoal: logo.hotGoal, started: logo.inView })`
    - `uSpin.value = logoSpin(logo.motion)` and `uHot.value = logo.motion.hot`
  - `advance(0)` therefore only writes uniforms, so the init call puts every logo at -1.9 and the first frame shows the night side.
  - After `disposers`, give each logo an `IntersectionObserver` with `{ threshold: sunriseVisibility }`.
    - Its callback sets `logo.inView = (entries.at(-1)?.intersectionRatio ?? 0) >= sunriseVisibility`. Do not use `isIntersecting`: it is also true below the threshold.
    - Call `observe(logo.node)` and push `disconnect` to `disposers`.
    - The sunrise starts at the first loop frame that sees `inView`, so it only starts while the canvas runs.

- [ ] **Step 8: Settle in `sync()`.**
  - Add `settleLogos(): boolean`. For each logo, record whether `logoSpin(logo.motion) !== 0`, then set `logo.motion = settleLogoMotion(logo.motion)`. Return whether any logo moved.
  - In `sync()`, after `if (lost) return;`, set `moved` to `settleLogos()` when `reduce.matches || frozen || isSceneHeld()`, else to false.
  - Keep the reduced-motion path (`advance(0); draw();`).
  - In the stopped branch, replace `if (frozen) draw();` with `if (frozen || moved) { advance(0); draw(); }`. That is one draw at the rest pose.
  - In `loop()`, the freeze branch becomes `frozen = true; sync(); return;`. `sync()` stops the loop, settles and draws.

- [ ] **Step 9: Fix the repo planets' view vector, then hover and disposal.**
  - In `planetVertex`, delete `varying vec3 vView;` and the `vView = normalize(-viewPosition.xyz);` line.
  - In `planetFragment`, delete `varying vec3 vView;` and replace `vec3 v = normalize(vView);` with `vec3 v = vec3(0.0, 0.0, 1.0);`.
  - The hover loop now iterates over `[...planets, ...logos]`; both carry `hotGoal` and `node`. `.closest(".repo-tile")` already matches the product tiles.
  - In `dispose()`, add `for (const logo of logos) logo.planet.dispose();` next to the material loop. The observers are disconnected through `disposers`.

- [ ] **Step 10: Static checks.**
  - Run `pnpm exec prettier --write src/lib/logo-planet.ts src/lib/repo-planets.ts`.
  - Each of these must exit 0:
    - `pnpm exec tsc --noEmit`
    - `pnpm exec eslint src/lib/logo-planet.ts src/lib/repo-planets.ts --max-warnings=0`
    - `pnpm exec knip`, which fails if `drawLogoMask` or `LogoUniforms` is exported
    - `pnpm build`, which must write `dist/index.html`
  - `rg -n "vView" src/lib` must print nothing.
  - `rg -c "vec3\(0\.0, 0\.0, 1\.0\)" src/lib/repo-planets.ts src/lib/logo-planet.ts` must print 1 for each file.

- [ ] **Step 11: Run the browser check to verify it passes.** Run `node /private/tmp/claude-501/-Users-pavstev-work-website/385f04a6-2dd8-4725-888b-36c85ac6599f/scratchpad/logo-planets-check.mjs http://localhost:4321 after`. Every line must print `PASS`, the exit code must be 0, and the printed renderer must not be SwiftShader. If a `match` value misses its threshold by less than 0.1, look at the saved PNGs before changing any code.
  - Open the `logo-*-S2-after.png` files: the marks are upright, not mirrored, and in the same place as on the flat tile.
  - Compare `repo-grid-before.png` with `repo-grid-after.png`. After the fix, every repo planet shows the same lighting wherever it sits: a glint at the upper left, a dark crescent at the lower right and a thin rim. Before, the glow and glint shifted with the tile position, and the rim covered most of the disc.
  - The repo planets look darker after the fix. Show both images to the owner instead of retuning the rim constants.

- [ ] **Commit.** `git add src/lib/logo-planet.ts src/lib/repo-planets.ts` then `git commit -m "feat(planets): draw the product logos as planets"` (husky runs `pnpm check`). Stop the dev server.

### Task 15: Docs and full verification

**Files:**

- Modify: `CLAUDE.md` (Tech Stack, Worker and `/mcp` bullets, "The card", "Layout")
- Modify: `README.md` only if it lists the card's sections or the MCP tools (check with `rg -n "open source|MCP|privacy" README.md`)
- Scratch (outside the repo): `/private/tmp/claude-501/-Users-pavstev-work-website/385f04a6-2dd8-4725-888b-36c85ac6599f/scratchpad/verify-products.mjs`

**Interfaces:**

- Consumes: everything from Tasks 1 to 14.
- Produces: nothing new; documentation and proof.

- [ ] **Step 1: Update CLAUDE.md**

Exact changes:

- Tech Stack, UI bullet: add `motion-toggle.tsx` to the `"use client"` list; say the planets canvas (`repo-planets.ts`) also draws the logo planets (`logo-planet.ts`, `logo-motion.ts`).
- New Tech Stack bullet **Products:** `src/lib/products.ts` (hand-written: name, url, schema type; text in `en.products`, colours in `productPalette` in `theme.ts`), `src/lib/product-marks.ts` (path data; the Safety Real Time mark comes from `https://safetyrealtime.com/wp-content/uploads/2022/11/srt_logo.svg`); they feed the tiles, JSON-LD (`WebApplication`/`SoftwareApplication` with the person as `creator`), the `llms.txt` Products section, the `/mcp` `products` tool and the profile README.
- `/mcp` bullet: six read-only tools; add `products` (the "Products" section of `llms.txt`).
- Privacy note and pause: replace "a `beforeInteractive` script in `layout.tsx` sets `data-privacy-ack` on `<html>` before paint" with: one inline `<script>` in `<head>` (`headScript` in `src/lib/motion-pause.ts`) sets `data-js`, `data-privacy-ack` and `data-motion-paused` before paint; `next/script` `beforeInteractive` runs after Next's main chunk in Next 16, so do not use it for pre-paint flags. Describe the dock (`page-dock.tsx`: pause button + privacy chip; the button stays after OK), the pause flag (`motion-paused` in `localStorage`, `isSceneHeld()` = held or paused, `stillQuery()` for DOM loops, `@variant still` rules and the hand-written paused twins), and that the sky and clouds keep an accumulated clock (`frame-clock.ts`).
- "The card": the order gains the products column; layout E (two columns from `64em`, card up to `68rem`, repos left, products right, one shared height through `subgrid`; stacked below, products 2 per row from `40rem`); product tiles (logo planet, name, "role · period", one line, whole tile links to the product in a new tab, `--lang` = brand tint); logo planets (sunrise from the night side once per page view, 2.4 s, then a plus or minus 0.35 rad wobble, hover spin-up, flat SVG marks as the fallback); the new no-scroll gate `(min-width: 64em) and (min-height: 45em), (min-width: 48em) and (min-height: 75em)`.
- "Layout" file list: add `card-strips`, `product-strip`, `product-mark`, `motion-toggle`, `page-dock` under `src/components/`, and `products`, `product-marks`, `logo-planet`, `logo-motion`, `motion-pause`, `frame-clock` under `src/lib/`.

- [ ] **Step 2: Run the gate**

Run: `pnpm check`
Expected: exits 0 (Prettier, ESLint 0 warnings, both `tsc` runs, all `node --test` files pass, knip clean, `next build` succeeds, profile validation passes).

- [ ] **Step 3: Start the built site**

Run `pnpm build` (already done by Step 2), then serve `dist` with the `preview` entry of `.claude/launch.json` (`pnpm preview`, port 4321) through the preview tool, not a plain shell.

- [ ] **Step 4: Write and run the verification script**

`verify-products.mjs` imports Playwright and axe by absolute path (`/Users/pavstev/powertools/node/node_modules/playwright/index.mjs`, `/Users/pavstev/powertools/node/node_modules/axe-core/axe.min.js`; ESM ignores `NODE_PATH`), runs with `node verify-products.mjs` against `http://localhost:4321/` and prints one PASS/FAIL line per check:

1. Pause before paint: `dist/index.html` has the inline `<script>` inside `<head>` before the first stylesheet `<link>`, and `__next_s` does not occur.
2. Pause flow: click `.motion-toggle`; `aria-pressed="true"`; `data-space-state` and `data-clouds-state` read `paused`; a `requestAnimationFrame` counter injected after the click counts 0 callbacks from the page's loops over 3 s (wrap `window.requestAnimationFrame` before load with `addInitScript` and count calls made after the click); no `data-glitch` on the name for 20 s; reload: `data-motion-paused` is present on `<html>` at `DOMContentLoaded`.
3. Globe: paused, open "Vienna", "Show on the globe", close it; `data-motion-paused` still present and `data-space-state` still `paused`.
4. Resume: click again; `aria-pressed="false"`; sky and clouds `running`; no visible jump (two screenshots 100 ms apart around the resume differ by less than the same pair taken while running; save them).
5. Storage throws: new context with `addInitScript` making `localStorage.getItem` and `setItem` throw; page loads without console errors; the button still pauses for the session.
6. Reduced motion: `emulateMedia({ reducedMotion: "reduce" })`; `.motion-toggle` is not visible; logo planets show one still frame at the rest pose (screenshot).
7. WebGL loss: `WEBGL_lose_context` on the planets canvas; `data-planets` is removed from `.card-strips`; the flat `.logo-planet svg` is visible again.
8. Privacy OK: press the chip, then OK; the chip is gone, `.motion-toggle` is still visible and works.
9. Layout: card height within 2 px of the Task 12 baselines at 1024x768, 1280x720, 1366x768, 1440x900, 1536x864, 1920x1080; column bottoms within 1 px at those sizes; 800x1200 and 1000x1200 do not scroll and the footer clears the dock; 768x1024, 820x1180, 1180x820 scroll; widths 320, 360, 390, 414, 430 have `scrollWidth <= innerWidth` and the dock after `main`; 200% zoom (`deviceScaleFactor` stays 1, CSS zoom via `document.documentElement.style.zoom = "2"` is not enough, so use a 640x400 and a 195x422 viewport, as in the mobile sweep) has no overflow and no overlap between the dock and the footer.
10. axe-core at 390x844, 1280x720 and 1920x1080: 0 violations.

Expected: every line PASS. Save screenshots next to the script.

- [ ] **Step 5: Lighthouse and contrast**

Run `~/powertools/scripts/lh-runs.sh http://localhost:4321/` and summarise with `node ~/powertools/scripts/lh-summary.mjs` (read both scripts' usage lines first) at desktop and mobile; run the same on `main` first for the comparison: performance not lower than before the branch, CLS 0, no console errors. Measure by hand the contrast of the product names, the role line and the "2 PRODUCTS" heading over the sky at 1024, 1280 and 1366 px wide, clouds running and paused: names at least 4.5:1, heading and role line at least 4.5:1 (they are small text).

- [ ] **Step 6: Independent review**

Dispatch one verifier agent that did not write the code (re-runs Step 4 and the edge cases in Review Focus) and one `code-reviewer` with the full `git diff main...feat/products-column` pasted in its prompt. Fix every finding, rerun `pnpm check` and Step 4, repeat until nothing is open.

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: products column, logo planets and pause button"
```

Then hand over with superpowers:finishing-a-development-branch. Merge or push only when the owner says so.
