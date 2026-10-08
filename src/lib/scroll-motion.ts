import { type StillQuery, stillQuery } from "@/lib/motion-pause";

export interface ScrollMotion {
  progress: number;
  velocity: number;
}

type ScrollListener = (motion: ScrollMotion, settled: boolean) => void;

const smoothTime = 0.38;
const fullSpeed = 3.5;
const settlePx = 0.4;
const settleSpeed = 0.002;
const measureDelayMs = 150;

const listeners = new Set<ScrollListener>();
const motion: ScrollMotion = { progress: 0, velocity: 0 };
let target = 0;
let current = 0;
let rate = 0;
let maxScroll = 0;
let viewHeight = 1;
let rafId = 0;
let last = 0;
let measureTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
let observer: ResizeObserver | undefined;
let reduceMotion: StillQuery | undefined;

const clampToOne = (value: number, min: number): number =>
  Math.min(1, Math.max(min, value));

const notify = (settled: boolean): void => {
  for (const listener of listeners) listener(motion, settled);
};

const settle = (value: number): void => {
  current = value;
  rate = 0;
  motion.progress = value;
  motion.velocity = 0;
  last = 0;
  notify(true);
};

const step = (now: number): void => {
  const dt = last > 0 ? Math.min((now - last) / 1000, 0.1) : 1 / 60;
  last = now;
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (rate + omega * change) * dt;
  rate = (rate - omega * temp) * decay;
  current = target + (change + temp) * decay;
  const pages = maxScroll / viewHeight;
  const speed = rate * pages;
  if (
    Math.abs(target - current) * maxScroll < settlePx &&
    Math.abs(speed) < settleSpeed
  ) {
    rafId = 0;
    settle(target);
    return;
  }
  motion.progress = current;
  motion.velocity = clampToOne(speed / fullSpeed, -1);
  notify(false);
  rafId = globalThis.requestAnimationFrame(step);
};

const readTarget = (): void => {
  if (reduceMotion?.matches === true) return;
  target = maxScroll > 0 ? clampToOne(window.scrollY / maxScroll, 0) : 0;
  if (rafId === 0 && target !== current) {
    rafId = globalThis.requestAnimationFrame(step);
  }
};

const measure = (): void => {
  viewHeight = Math.max(1, window.innerHeight);
  maxScroll = Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight
  );
  readTarget();
};

const scheduleMeasure = (): void => {
  if (measureTimer !== undefined) globalThis.clearTimeout(measureTimer);
  measureTimer = globalThis.setTimeout(measure, measureDelayMs);
};

const onReduceChange = (): void => {
  if (rafId !== 0) globalThis.cancelAnimationFrame(rafId);
  rafId = 0;
  if (reduceMotion?.matches === true) {
    target = 0;
    settle(0);
    return;
  }
  measure();
};

const attach = (): void => {
  reduceMotion = stillQuery();
  measure();
  current = target;
  motion.progress = target;
  window.addEventListener("scroll", readTarget, { passive: true });
  window.addEventListener("resize", scheduleMeasure);
  reduceMotion.addEventListener("change", onReduceChange);
  observer = new ResizeObserver(scheduleMeasure);
  observer.observe(document.documentElement);
};

const detach = (): void => {
  if (rafId !== 0) globalThis.cancelAnimationFrame(rafId);
  rafId = 0;
  last = 0;
  if (measureTimer !== undefined) globalThis.clearTimeout(measureTimer);
  measureTimer = undefined;
  window.removeEventListener("scroll", readTarget);
  window.removeEventListener("resize", scheduleMeasure);
  reduceMotion?.removeEventListener("change", onReduceChange);
  observer?.disconnect();
  observer = undefined;
};

export const watchScrollMotion = (listener: ScrollListener): (() => void) => {
  if (listeners.size === 0) attach();
  listeners.add(listener);
  listener(motion, true);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) detach();
  };
};
