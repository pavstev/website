"use client";

import { type ReactElement, useEffect, useRef } from "react";

import { prefersLightLoad } from "@/lib/save-data";
import { hasSeenSoftwareRenderer } from "@/lib/webgl";

interface RepoPlanetsCanvasProps {
  active: boolean;
}

export const RepoPlanetsCanvas = ({
  active,
}: RepoPlanetsCanvasProps): ReactElement => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!active || !canvas) return;
    const { parentElement: stage } = canvas;
    if (!stage || prefersLightLoad() || hasSeenSoftwareRenderer()) return;
    let dispose: (() => void) | undefined;
    let alive = true;
    const boot = async (): Promise<void> => {
      try {
        const planets = await import("@/lib/repo-planets");
        if (alive) ({ dispose } = planets.initRepoPlanets(canvas, stage));
      } catch {
        dispose = undefined;
      }
    };
    void boot();
    return () => {
      alive = false;
      dispose?.();
    };
  }, [active]);

  return <canvas aria-hidden="true" className="repo-planets" ref={ref} />;
};
