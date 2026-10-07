"use client";

import { type ReactElement, useEffect, useRef } from "react";

import { prefersLightLoad } from "@/lib/save-data";
import { hasSeenSoftwareRenderer } from "@/lib/webgl";

export const RepoPlanetsCanvas = (): ReactElement => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const { parentElement: stage } = canvas;
    if (!stage || prefersLightLoad()) return;
    let dispose: (() => void) | undefined;
    let alive = true;
    let idleHandle: number | undefined;
    let timerHandle: ReturnType<typeof globalThis.setTimeout> | undefined;
    const boot = (): void => {
      if (hasSeenSoftwareRenderer()) return;
      void import("@/lib/repo-planets")
        .then((module) => {
          if (!alive) return;
          const controls = module.initRepoPlanets(canvas, stage);
          ({ dispose } = controls);
        })
        .catch(() => undefined);
    };
    const schedule = (): void => {
      if (typeof globalThis.requestIdleCallback === "function") {
        idleHandle = globalThis.requestIdleCallback(boot, { timeout: 2000 });
      } else {
        timerHandle = globalThis.setTimeout(boot, 500);
      }
    };
    if (document.readyState === "complete") schedule();
    else globalThis.addEventListener("load", schedule, { once: true });
    return () => {
      alive = false;
      globalThis.removeEventListener("load", schedule);
      if (idleHandle !== undefined) globalThis.cancelIdleCallback(idleHandle);
      if (timerHandle !== undefined) globalThis.clearTimeout(timerHandle);
      dispose?.();
    };
  }, []);

  return <canvas aria-hidden="true" className="repo-planets" ref={ref} />;
};
