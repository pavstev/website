import { reducedMotionQuery } from "@/lib/media";

const introEndMs = 5600;
const firstGapMs = 2400;
const everyMs = 8000;
const restAfterMs = 30_000;
const burstMs = 720;
const wakeEvents = ["pointermove", "pointerdown", "keydown", "wheel", "scroll"];

export const initNameGlitch = (name: HTMLElement): (() => void) => {
  const reduce = globalThis.matchMedia(reducedMotionQuery);
  let lastInput = performance.now();
  let tick: ReturnType<typeof setTimeout> | undefined;
  let settle: ReturnType<typeof setTimeout> | undefined;

  const wake = (): void => {
    lastInput = performance.now();
  };

  const fire = (): void => {
    tick = globalThis.setTimeout(fire, everyMs);
    if (
      reduce.matches ||
      document.hidden ||
      performance.now() - lastInput > restAfterMs
    )
      return;
    name.dataset.tuned = "";
    name.dataset.glitch = "";
    globalThis.clearTimeout(settle);
    settle = globalThis.setTimeout(() => {
      delete name.dataset.glitch;
    }, burstMs);
  };

  for (const type of wakeEvents) {
    globalThis.addEventListener(type, wake, { passive: true });
  }
  tick = globalThis.setTimeout(
    fire,
    Math.max(firstGapMs, introEndMs + firstGapMs - performance.now())
  );

  return () => {
    for (const type of wakeEvents) {
      globalThis.removeEventListener(type, wake);
    }
    globalThis.clearTimeout(tick);
    globalThis.clearTimeout(settle);
    delete name.dataset.glitch;
  };
};
