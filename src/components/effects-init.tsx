import { useEffect } from "react";

import { initAnchoredPopovers } from "@/lib/anchored-popovers";
import { initCursorEffects } from "@/lib/cursor";
import { initIntro } from "@/lib/intro";
import { initNameGlitch } from "@/lib/name-glitch";
import { initPortraitEffects } from "@/lib/portrait-effects";

export const EffectsInit = (): null => {
  useEffect(() => {
    const portrait = document.querySelector<HTMLElement>("[data-portrait]");
    const card = document.querySelector<HTMLElement>("[data-card]");
    const name = document.querySelector<HTMLElement>("[data-name]");
    const disposers: Array<() => void> = [];
    if (portrait) disposers.push(initPortraitEffects(portrait));
    if (card) disposers.push(initIntro(card));
    if (name) disposers.push(initNameGlitch(name));
    disposers.push(initCursorEffects(), initAnchoredPopovers(document));
    return () => {
      for (const dispose of disposers) dispose();
    };
  }, []);
  return null;
};
