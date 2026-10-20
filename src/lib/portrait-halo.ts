import {
  haloFps,
  haloLit,
  haloPulse,
  outlineAlpha,
  type RimCells,
  rimCells,
} from "@/lib/portrait-dither";
import { ditherOutline, ditherTones } from "@/lib/theme";

export interface PortraitHalo {
  dispose: () => void;
  setStill: (still: boolean) => void;
}

export interface PortraitHaloOptions {
  cellScale?: number;
}

const maxPixelRatio = 3;

export const createPortraitHalo = (
  host: HTMLElement,
  options: PortraitHaloOptions = {}
): PortraitHalo => {
  const cellScale = options.cellScale ?? 1;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return { dispose: () => undefined, setStill: () => undefined };
  canvas.className = "portrait-rim";
  canvas.setAttribute("aria-hidden", "true");
  host.append(canvas);
  const origin = performance.now();
  let cells: null | RimCells = null;
  let fittedWidth = 0;
  let fittedRatio = 0;
  let still = false;
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined;

  const render = (): void => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!cells) return;
    const seconds = still ? 0 : (performance.now() - origin) / 1000;
    context.fillStyle = ditherTones[2];
    for (let index = 0; index < cells.x.length; index++) {
      const lit = haloLit(
        cells.falloff[index] ?? 0,
        haloPulse(seconds, cells.depth[index] ?? 0),
        cells.threshold[index] ?? 1
      );
      if (!lit) continue;
      context.globalAlpha = cells.alpha[index] ?? 0;
      context.fillRect(
        cells.x[index] ?? 0,
        cells.y[index] ?? 0,
        cells.size,
        cells.size
      );
    }
    context.fillStyle = ditherOutline;
    context.globalAlpha = outlineAlpha;
    for (let index = 0; index < cells.edgeX.length; index++) {
      context.fillRect(
        cells.edgeX[index] ?? 0,
        cells.edgeY[index] ?? 0,
        cells.size,
        cells.size
      );
    }
    context.globalAlpha = 1;
  };

  const stop = (): void => {
    globalThis.clearTimeout(timer);
    timer = undefined;
  };

  const tick = (): void => {
    timer = undefined;
    if (still || document.hidden) return;
    render();
    timer = globalThis.setTimeout(tick, 1000 / haloFps);
  };

  const resume = (): void => {
    if (timer !== undefined || still || document.hidden) return;
    tick();
  };

  const fit = (): void => {
    const width = host.clientWidth;
    if (width <= 0) return;
    const ratio = Math.min(globalThis.devicePixelRatio || 1, maxPixelRatio);
    if (width === fittedWidth && ratio === fittedRatio) return;
    fittedWidth = width;
    fittedRatio = ratio;
    const built = rimCells(width, ratio, cellScale);
    cells = built;
    canvas.width = built.side;
    canvas.height = built.side;
    canvas.style.setProperty("--rim", `${String(built.margin)}px`);
    render();
  };

  const onVisibility = (): void => {
    if (document.hidden) stop();
    else resume();
  };

  const observer = new ResizeObserver(fit);
  observer.observe(host);
  document.addEventListener("visibilitychange", onVisibility);
  fit();

  return {
    dispose: (): void => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.remove();
    },
    setStill: (next: boolean): void => {
      still = next;
      stop();
      if (still) render();
      else resume();
    },
  };
};
