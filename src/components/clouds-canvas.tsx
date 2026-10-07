"use client";

import { type ReactElement, useEffect, useRef } from "react";

import { hasSeenSoftwareRenderer, isSoftwareRenderer } from "@/lib/webgl";

interface ConnectionHint {
  saveData?: boolean;
}

const contextAttributes: WebGLContextAttributes = {
  alpha: false,
  antialias: false,
  depth: false,
  powerPreference: "low-power",
  stencil: false,
};

const prefersLightLoad = (): boolean => {
  const { connection } = navigator as Navigator & {
    connection?: ConnectionHint;
  };
  return connection?.saveData === true;
};

export const CloudsCanvas = (): ReactElement => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || prefersLightLoad()) return;
    let dispose: (() => void) | undefined;
    let alive = true;
    let idleHandle: number | undefined;
    let timerHandle: ReturnType<typeof globalThis.setTimeout> | undefined;
    const hide = (): void => {
      canvas.hidden = true;
      canvas.dataset.cloudsState = "fallback";
    };
    const boot = (): void => {
      if (hasSeenSoftwareRenderer()) {
        hide();
        return;
      }
      const context = canvas.getContext("webgl2", contextAttributes);
      if (!context || isSoftwareRenderer(context)) {
        hide();
        return;
      }
      void import("@/lib/clouds")
        .then((module) => {
          if (alive) dispose = module.initClouds(canvas, context);
        })
        .catch(hide);
    };
    const schedule = (): void => {
      if (typeof globalThis.requestIdleCallback === "function") {
        idleHandle = globalThis.requestIdleCallback(boot, { timeout: 1500 });
      } else {
        timerHandle = globalThis.setTimeout(boot, 300);
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
      dispose = undefined;
    };
  }, []);
  return <canvas aria-hidden="true" data-clouds="" ref={ref} />;
};
