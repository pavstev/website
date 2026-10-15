"use client";

import { useEffect } from "react";

import { type CondenseRange, useCondense } from "@/components/ui/sticky-header";

const barSelector = "[data-blog-bar]";
const titleSelector = "[data-sky-header] .blog-title";
const travel = 96;
const props = ["--glass", "--lift", "--bar-in"] as const;

const pageTop = (element: HTMLElement): number => {
  let top = 0;
  let node: Element | null = element;
  while (node instanceof HTMLElement) {
    top += node.offsetTop;
    node = node.offsetParent;
  }
  return top;
};

const measureTitle = (): CondenseRange | undefined => {
  const bar = document.querySelector<HTMLElement>(barSelector);
  const title = document.querySelector<HTMLElement>(titleSelector);
  if (!bar || !title) return undefined;
  const to = Math.max(
    1,
    pageTop(title) + title.offsetHeight / 2 - bar.offsetHeight
  );
  return { from: Math.max(0, to - travel), to };
};

const ramp = (value: number, from: number, to: number): string =>
  Math.min(1, Math.max(0, (value - from) / (to - from))).toFixed(3);

export const BarSpy = (): null => {
  const progress = useCondense(measureTitle);

  useEffect(() => {
    const bar = document.querySelector<HTMLElement>(barSelector);
    const scope = bar?.parentElement;
    if (!bar || !scope) return;
    const apply = (value: number): void => {
      scope.style.setProperty("--glass", ramp(value, 0, 0.6));
      scope.style.setProperty("--lift", ramp(value, 0, 0.45));
      scope.style.setProperty("--bar-in", ramp(value, 0.55, 0.9));
      if (value >= 0.5) bar.dataset["stuck"] = "";
      else delete bar.dataset["stuck"];
    };
    apply(progress.get());
    const stop = progress.on("change", apply);
    return (): void => {
      stop();
      for (const name of props) scope.style.removeProperty(name);
      delete bar.dataset["stuck"];
    };
  }, [progress]);

  return null;
};
