"use client";

import { type ReactElement, useEffect, useRef } from "react";

import { isCoarseDevice, scheduleIdle, scheduleStaggered } from "@/lib/idle";
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
    let cancelBoot: (() => void) | undefined;
    const boot = async (): Promise<void> => {
      if (hasSeenSoftwareRenderer()) return;
      try {
        const planets = await import("@/lib/repo-planets");
        if (alive) ({ dispose } = planets.initRepoPlanets(canvas, stage));
      } catch {
        dispose = undefined;
      }
    };
    const options = { fallbackMs: 500, timeout: 2000 };
    const schedule = (): void => {
      cancelBoot = scheduleIdle(boot, options);
    };
    if (isCoarseDevice()) {
      cancelBoot = scheduleStaggered(boot, options);
    } else if (document.readyState === "complete") schedule();
    else globalThis.addEventListener("load", schedule, { once: true });
    return () => {
      alive = false;
      globalThis.removeEventListener("load", schedule);
      cancelBoot?.();
      dispose?.();
    };
  }, []);

  return <canvas aria-hidden="true" className="repo-planets" ref={ref} />;
};
