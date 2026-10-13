"use client";

import { useEffect } from "react";

const barSelector = "[data-blog-bar]";
const titleSelector = "[data-sky-header] .blog-title";

export const BarSpy = (): null => {
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>(barSelector);
    const title = document.querySelector(titleSelector);
    if (!bar || !title) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.at(-1);
        if (entry === undefined) return;
        const top = entry.rootBounds?.top ?? 0;
        if (entry.intersectionRatio < 0.5 && entry.boundingClientRect.top < top)
          bar.dataset["stuck"] = "";
        else delete bar.dataset["stuck"];
      },
      {
        rootMargin: `-${String(Math.round(bar.offsetHeight))}px 0px 0px 0px`,
        threshold: [0, 0.5, 1],
      }
    );
    observer.observe(title);
    return (): void => {
      observer.disconnect();
      delete bar.dataset["stuck"];
    };
  }, []);
  return null;
};
