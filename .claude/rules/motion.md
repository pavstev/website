---
paths:
  - "src/layouts/Base.astro"
  - "src/styles/globals.css"
  - "src/styles/card.css"
  - "src/styles/blog.css"
  - "src/components/sky-controls.tsx"
  - "src/components/motion-switch.astro"
  - "src/lib/motion-switch.ts"
  - "src/components/site-footer.astro"
  - "src/components/page-dock.tsx"
  - "src/components/privacy-note.tsx"
  - "src/components/privacy-ack.tsx"
  - "src/lib/home-effects.ts"
  - "src/lib/motion-pause.ts"
  - "src/lib/motion-pause.test.ts"
  - "src/lib/scene-hold.ts"
  - "src/lib/privacy-ack.ts"
  - "src/lib/media.ts"
  - "src/lib/save-data.ts"
  - "src/lib/frame-pacer.ts"
  - "src/lib/idle.ts"
---

# Motion, dock and privacy

Siblings: `card.md`, `sky.md`.

## Head script

- One plain inline `<script>` is the first child of `<head>` in `Base.astro` (`headScript` in `motion-pause.ts`, inlined with `set:html`).
- It runs before first paint. It sets `data-js`, then `data-privacy-ack` and `data-motion-paused` from `localStorage`, inside a `try`.
- Keep it a plain inline script in `<head>`. Never a module or a deferred script.
- It runs on a full load only. `router-flags.ts` copies the live `<html>` `data-*` attributes onto the incoming document before each swap.

## Motion pause (WCAG 2.2.2)

- The Motion switch pauses motion. State is `html[data-motion-paused]` plus `localStorage["motion-paused"] = "1"`. Storage errors make it session-only.
- `setMotionPaused` sets both, then dispatches `scene:hold` and `motion:pause`. A `storage` event makes other tabs follow.
- The switch is `motion-switch.astro` (markup) plus `src/lib/motion-switch.ts` (`watchMotionSwitches`). It needs no `client:` directive.
- On the home it is the last row of the sky panel, as the child of `SkyControls`. On night pages it sits in the footer row (`.footer-motion`).
- The track is 34 x 20 px with a 16 px thumb. Forced colors give it `ButtonText` borders and a `Highlight` track.
- `.sky-motion` and `.footer-motion` hide under OS reduced motion. They have no paused twin, because the switch must stay to resume.
- `isSceneHeld()` in `scene-hold.ts` is true while paused. `motion-pause.ts` imports from `scene-hold.ts`, never the other way (cycle).
- Canvases (sky, name tear) stop through `isSceneHeld()` and keep their last frame. The sky ignores pointer moves while held.
- DOM loops take their still path through `stillQuery()`, shaped like a `MediaQueryList`. React parts use `useStill()`.
- CSS: `@custom-variant still` is used only as `@variant still` nested in a rule with one selector and no pseudo-element.
- Every other reduced-motion rule has a hand-written `:root[data-motion-paused]` twin right after it.
- After a CSS change, the built CSS must hold no `:scope` and a paused twin for every other reduced-motion selector.

## Reduced motion and effects

- `prefers-reduced-motion`: the intro exits early. Sky, portrait effects and cursor follow the setting at runtime. CSS animations collapse to `0.01ms`.
- Pointer-following effects (star parallax, cloud wind) run only for `(hover: hover) and (pointer: fine)`. The portrait lens is the exception.
- The portrait halo pulses at 15 fps, stops while the tab is hidden, and draws one still frame under reduced motion, pause and Save-Data.
- Home effects (`home-effects.ts`, `watchHomeEffects`) start when `[data-card]` is present and stop on `astro:before-swap`.
- The name tear engine starts on idle. On coarse pointers it waits for `load` (`scheduleStaggered`). The portrait lens loads its photo on first use.

## Dock

- The dock is an `<aside class="page-dock">` named "Privacy" after `main`. It is not a `footer`: the night footer stays the only `contentinfo`.
- From `(min-width: 48em) and (min-height: 45em)` the dock is `fixed`, and `#main-content` reserves `--privacy-zone`. Below that it sits in the flow.
- Blog pages wrap it in `.blog-dock`, which keeps it in the flow at the page end under the footer, at every size.
- The rule is `.blog-dock .page-dock`, a descendant selector, because the island adds an `astro-island` wrapper.
- `:root[data-privacy-ack] .page-dock` and `:root[data-privacy-closed] .page-dock` hide it. Print hides it.

## Privacy note

- `privacy-note.tsx` is a D2 control chip with a 6 px moss dot and the text "No cookies, anonymous stats". It is a `<button popovertarget>`.
- The panel is a named `role="dialog"` (`en.privacy.label`) and the chip has `aria-haspopup="dialog"`. It is anchored above the chip.
- OK stores `privacy-ack` in `localStorage`, closes the panel and sets `data-privacy-closed`. `--privacy-zone` drops to `0px` and `#main-content` eases its padding.
- On later visits the head script sets `data-privacy-ack` before paint.
- A label that wraps keeps the dot beside its first line.
- The note must stay true: no cookies, no ads, no trackers that follow people. Anything that sets cookies needs a real opt-in flow first, with Decline as easy as Accept.
- Cloudflare Web Analytics is cookieless and switched on in the dashboard. The CSP allows its two hosts.

## Popover guards

- In sheet mode, `anchored-popovers.ts` swallows the click after a tap outside an open panel for 450 ms.
- A panel with `[data-initial-focus]` takes focus there when opened by click or Enter.
- The sky panel marks its selected tab and picks the start tab on `beforetoggle`. It closes when focus leaves it for anything but the pill.
- `.sky-range` and its scale use `touch-action: none`.
