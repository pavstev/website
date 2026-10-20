import {
  bayerThreshold,
  cellCssPx,
  cellInCircle,
  lensHaloAlpha,
  lensRadiusShare,
  lensRing,
  lensZoom,
  lumaOf,
  outlineAlpha,
  pickTone,
} from "@/lib/portrait-dither";
import { ditherOutline, ditherTones } from "@/lib/theme";
import { hasSeenSoftwareRenderer } from "@/lib/webgl";

export interface PortraitLens {
  dispose: () => void;
  hide: () => void;
  move: (x: number, y: number) => void;
  show: (x: number, y: number) => void;
}

export interface PortraitLensOptions {
  radiusPx?: number;
}

const maxPixelRatio = 3;
const lumaSide = 384;
const growRate = 7;
const followRate = 14;

interface Ready {
  canvas: HTMLCanvasElement;
  cell: number;
  context: CanvasRenderingContext2D;
  lensRadius: number;
  luma: Uint8ClampedArray;
  lumaSide: number;
  side: number;
}

const readLuma = (
  image: HTMLImageElement
): null | { luma: Uint8ClampedArray; side: number } => {
  const side = Math.min(lumaSide, image.naturalWidth || lumaSide);
  const scratch = document.createElement("canvas");
  scratch.width = side;
  scratch.height = side;
  const context = scratch.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, side, side);
  const { data } = context.getImageData(0, 0, side, side);
  const luma = new Uint8ClampedArray(side * side);
  for (let index = 0; index < luma.length; index++) {
    const at = index * 4;
    luma[index] = Math.round(
      lumaOf(data[at] ?? 0, data[at + 1] ?? 0, data[at + 2] ?? 0) * 255
    );
  }
  return { luma, side };
};

const startEngine = (image: HTMLImageElement): null | Ready => {
  const sampled = readLuma(image);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!sampled || !context) return null;
  canvas.className = "portrait-dither";
  canvas.setAttribute("aria-hidden", "true");
  return {
    canvas,
    cell: 1,
    context,
    lensRadius: 0,
    luma: sampled.luma,
    lumaSide: sampled.side,
    side: 0,
  };
};

export const createPortraitLens = (
  host: HTMLElement,
  source: string,
  options: PortraitLensOptions = {}
): PortraitLens => {
  let ready: null | Ready = null;
  let loading = false;
  let failed = false;
  let epoch = 0;
  let frame = 0;
  let last = 0;
  let hover = 0;
  let target = 0;
  const aim = { x: 0.5, y: 0.5 };
  const smooth = { x: 0.5, y: 0.5 };

  const fit = (current: Ready): void => {
    const width = Math.max(1, host.clientWidth);
    const ratio = Math.min(globalThis.devicePixelRatio || 1, maxPixelRatio);
    const side = Math.max(1, Math.round(width * ratio));
    const share = (lensRadiusShare * width) / 2;
    const lensCss =
      options.radiusPx === undefined
        ? share
        : Math.min(share, options.radiusPx);
    current.cell = Math.max(1, Math.round(cellCssPx * ratio));
    current.lensRadius = lensCss * ratio;
    if (current.side === side) return;
    current.side = side;
    current.canvas.width = side;
    current.canvas.height = side;
  };

  const paintLens = (current: Ready, radius: number): void => {
    const { cell, context, luma, side } = current;
    const half = side / 2;
    const px = smooth.x * side;
    const py = smooth.y * side;
    const reach = radius + cell * 3;
    const top = Math.floor((py - reach) / cell);
    const bottom = Math.ceil((py + reach) / cell);
    const left = Math.floor((px - reach) / cell);
    const right = Math.ceil((px + reach) / cell);
    const edge = current.lumaSide - 1;
    let painted = "";
    let alpha = 1;
    const paint = (color: string, opacity: number): void => {
      if (color !== painted) {
        painted = color;
        context.fillStyle = color;
      }
      if (opacity === alpha) {
        return;
      }

      alpha = opacity;
      context.globalAlpha = opacity;
    };
    for (let gy = top; gy <= bottom; gy++) {
      const my = gy * cell + cell / 2;
      for (let gx = left; gx <= right; gx++) {
        const mx = gx * cell + cell / 2;
        if (!cellInCircle(mx, my, half, half, half)) continue;
        if (!cellInCircle(mx, my, px, py, radius)) {
          const ring = lensRing(
            Math.hypot(mx - px, my - py),
            radius,
            cell,
            bayerThreshold(gx, gy)
          );
          if (ring === undefined) continue;
          if (ring === "outline") paint(ditherOutline, outlineAlpha);
          else paint(ditherTones[2], lensHaloAlpha);
          context.fillRect(gx * cell, gy * cell, cell, cell);
          continue;
        }
        const sx = px + (mx - px) / lensZoom;
        const sy = py + (my - py) / lensZoom;
        const lx = Math.min(
          edge,
          Math.max(0, Math.floor((sx / side) * (edge + 1)))
        );
        const ly = Math.min(
          edge,
          Math.max(0, Math.floor((sy / side) * (edge + 1)))
        );
        paint(
          pickTone(
            (luma[ly * current.lumaSide + lx] ?? 0) / 255,
            bayerThreshold(gx, gy)
          ),
          1
        );
        context.fillRect(gx * cell, gy * cell, cell, cell);
      }
    }
    context.globalAlpha = 1;
  };

  const draw = (now: number): void => {
    frame = 0;
    const current = ready;
    if (!current) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
    last = now;
    hover += (target - hover) * (1 - Math.exp(-dt * growRate));
    const follow = 1 - Math.exp(-dt * followRate);
    smooth.x += (aim.x - smooth.x) * follow;
    smooth.y += (aim.y - smooth.y) * follow;
    current.context.clearRect(0, 0, current.side, current.side);
    if (target === 0 && hover < 0.004) {
      hover = 0;
      last = 0;
      return;
    }
    paintLens(current, current.lensRadius * hover);
    frame = globalThis.requestAnimationFrame(draw);
  };

  const run = (): void => {
    if (frame !== 0 || !ready) return;
    fit(ready);
    frame = globalThis.requestAnimationFrame(draw);
  };

  const load = async (): Promise<void> => {
    loading = true;
    const mine = epoch;
    const image = new Image();
    image.decoding = "async";
    image.src = source;
    try {
      await image.decode();
    } catch {
      if (mine === epoch) {
        loading = false;
        failed = true;
      }
      return;
    }
    if (mine !== epoch) return;
    loading = false;
    const started = startEngine(image);
    if (!started) {
      failed = true;
      return;
    }
    ready = started;
    host.append(started.canvas);
    if (target === 0) return;
    smooth.x = aim.x;
    smooth.y = aim.y;
    run();
  };

  const prepare = (): void => {
    if (ready || loading || failed) return;
    if (hasSeenSoftwareRenderer()) {
      failed = true;
      return;
    }
    void load();
  };

  const place = (x: number, y: number): void => {
    aim.x = x;
    aim.y = y;
  };

  return {
    dispose: (): void => {
      if (frame !== 0) globalThis.cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      hover = 0;
      target = 0;
      epoch++;
      loading = false;
      ready?.canvas.remove();
      ready = null;
    },
    hide: (): void => {
      target = 0;
    },
    move: place,
    show: (x: number, y: number): void => {
      place(x, y);
      if (target === 0 && hover < 0.004) {
        smooth.x = x;
        smooth.y = y;
      }
      target = 1;
      prepare();
      run();
    },
  };
};
