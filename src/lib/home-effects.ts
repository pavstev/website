import { initAnchoredPopovers } from "@/lib/anchored-popovers";
import { initCursorEffects } from "@/lib/cursor";
import { initIntro } from "@/lib/intro";
import { initNameGlitch } from "@/lib/name-glitch";
import { initPortraitEffects } from "@/lib/portrait-effects";

export const watchHomeEffects = (): void => {
  let started: HTMLElement | null = null;
  let disposers: Array<() => void> = [];
  const stop = (): void => {
    for (const dispose of disposers) dispose();
    disposers = [];
    started = null;
  };
  const start = (): void => {
    const card = document.querySelector<HTMLElement>("[data-card]");
    if (!card || card === started) return;
    started = card;
    const portrait = document.querySelector<HTMLElement>("[data-portrait]");
    const name = document.querySelector<HTMLElement>("[data-name]");
    if (portrait) disposers.push(initPortraitEffects(portrait));
    disposers.push(initIntro(card));
    if (name) disposers.push(initNameGlitch(name));
    disposers.push(initCursorEffects(), initAnchoredPopovers(document));
  };
  start();
  document.addEventListener("astro:page-load", start);
  document.addEventListener("astro:before-swap", stop);
};
