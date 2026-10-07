"use client";

import { useEffect } from "react";

import { initAnchoredPopovers } from "@/lib/anchored-popovers";
import { initContactLinks } from "@/lib/contact-links";
import { initPointerLight } from "@/lib/cursor";
import { initIntro } from "@/lib/intro";
import { initNameGlitch } from "@/lib/name-glitch";
import { initPortraitEffects } from "@/lib/portrait-effects";
import { initTagFit } from "@/lib/repo-tags-fit";

export const EffectsInit = (): null => {
  useEffect(() => {
    const portrait = document.querySelector<HTMLElement>("[data-portrait]");
    const card = document.querySelector<HTMLElement>("[data-card]");
    const contacts = document.querySelector<HTMLElement>("[data-contacts]");
    const name = document.querySelector<HTMLElement>("[data-name]");
    const disposers: Array<() => void> = [];
    if (portrait) disposers.push(initPortraitEffects(portrait));
    if (card) disposers.push(initIntro(card));
    if (name) disposers.push(initNameGlitch(name));
    if (contacts) disposers.push(initContactLinks(contacts));
    if (card) disposers.push(initPointerLight(card));
    disposers.push(initAnchoredPopovers(document), initTagFit(document));
    return () => {
      for (const dispose of disposers) dispose();
    };
  }, []);
  return null;
};
