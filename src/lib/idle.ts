import { finePointerQuery } from "@/lib/media";

interface IdleOptions {
  fallbackMs: number;
  timeout: number;
}

interface Slot {
  cancelled: boolean;
  options: IdleOptions;
  run: () => unknown;
}

const waiting: Slot[] = [];
let cancelPump: (() => void) | undefined;
let busy = false;

export const isCoarseDevice = (): boolean =>
  !globalThis.matchMedia(finePointerQuery).matches;

export const scheduleIdle = (
  run: () => unknown,
  { fallbackMs, timeout }: IdleOptions
): (() => void) => {
  if (typeof globalThis.requestIdleCallback === "function") {
    const handle = globalThis.requestIdleCallback(run, { timeout });
    return (): void => {
      globalThis.cancelIdleCallback(handle);
    };
  }
  const handle = globalThis.setTimeout(run, fallbackMs);
  return (): void => {
    globalThis.clearTimeout(handle);
  };
};

const pump = async (): Promise<void> => {
  cancelPump = undefined;
  let slot = waiting.shift();
  while (slot?.cancelled) slot = waiting.shift();
  if (!slot) return;
  busy = true;
  try {
    await slot.run();
  } catch (error: unknown) {
    reportError(error);
  }
  busy = false;
  const [next] = waiting;
  if (next) cancelPump = scheduleIdle(pump, next.options);
};

const enqueue = (slot: Slot): void => {
  waiting.push(slot);
  if (!busy) cancelPump ??= scheduleIdle(pump, slot.options);
};

export const scheduleStaggered = (
  run: () => unknown,
  options: IdleOptions
): (() => void) => {
  const slot: Slot = { cancelled: false, options, run };
  const start = (): void => {
    enqueue(slot);
  };
  if (document.readyState === "complete") start();
  else globalThis.addEventListener("load", start, { once: true });
  return (): void => {
    slot.cancelled = true;
    globalThis.removeEventListener("load", start);
  };
};
