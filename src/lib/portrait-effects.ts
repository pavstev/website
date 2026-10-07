import { finePointerQuery, reducedMotionQuery } from "@/lib/media";

const cometMs = 16_000;
const whisperMs = 44_000;
const breathMs = 7000;
const hoverRate = 4;
const openRate = 14;
const rampMs = 700;
const openHoldMs = 520;

const clampPercent = (value: number): number =>
  Math.min(100, Math.max(0, value));

const toPercent = (value: number): string =>
  `${clampPercent(value).toFixed(1)}%`;

const isMouse = (event: Event): boolean =>
  event instanceof PointerEvent && event.pointerType === "mouse";

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

const startOrbit = (root: HTMLElement): (() => void) => {
  const comet = root.querySelector<HTMLElement>("[data-orbit-comet]");
  const whisper = root.querySelector<HTMLElement>("[data-orbit-whisper]");
  const track = root.querySelector<HTMLElement>("[data-orbit-track]");
  const loop = { iterations: Infinity };
  const spin = comet?.animate([{ rotate: "0deg" }, { rotate: "360deg" }], {
    ...loop,
    duration: cometMs,
  });
  const drift = whisper?.animate([{ rotate: "0deg" }, { rotate: "-360deg" }], {
    ...loop,
    duration: whisperMs,
  });
  const breath = track?.animate(
    [{ opacity: 0.45 }, { opacity: 1 }, { opacity: 0.45 }],
    { ...loop, duration: breathMs, easing: "ease-in-out" }
  );

  let rate = 1;
  let frame = 0;
  let hovering = false;
  let hold: ReturnType<typeof setTimeout> | undefined;

  const applyRate = (value: number): void => {
    rate = value;
    spin?.updatePlaybackRate(value);
    drift?.updatePlaybackRate(1 + (value - 1) * 0.35);
  };

  const rampTo = (target: number, ms: number): void => {
    if (frame !== 0) globalThis.cancelAnimationFrame(frame);
    const from = rate;
    const started = performance.now();
    const step = (now: number): void => {
      const k = Math.min(1, (now - started) / ms);
      applyRate(from + (target - from) * easeOutCubic(k));
      frame = k < 1 ? globalThis.requestAnimationFrame(step) : 0;
    };
    frame = globalThis.requestAnimationFrame(step);
  };

  const resting = (): number => (hovering ? hoverRate : 1);

  const onEnter = (event: Event): void => {
    if (!isMouse(event)) return;
    hovering = true;
    if (hold === undefined) rampTo(hoverRate, rampMs);
  };

  const onLeave = (event: Event): void => {
    if (!isMouse(event)) return;
    hovering = false;
    if (hold === undefined) rampTo(1, rampMs * 1.6);
  };

  const onOpen = (): void => {
    globalThis.clearTimeout(hold);
    rampTo(openRate, 220);
    hold = globalThis.setTimeout(() => {
      hold = undefined;
      rampTo(resting(), rampMs * 2);
    }, openHoldMs);
  };

  root.addEventListener("pointerenter", onEnter);
  root.addEventListener("pointerleave", onLeave);
  root.addEventListener("portrait:open", onOpen);

  return () => {
    root.removeEventListener("pointerenter", onEnter);
    root.removeEventListener("pointerleave", onLeave);
    root.removeEventListener("portrait:open", onOpen);
    globalThis.clearTimeout(hold);
    if (frame !== 0) globalThis.cancelAnimationFrame(frame);
    spin?.cancel();
    drift?.cancel();
    breath?.cancel();
  };
};

const startEffects = (root: HTMLElement): (() => void) => {
  const fine = globalThis.matchMedia(finePointerQuery);
  const relight = root.querySelector<HTMLElement>("[data-relight]");
  const foil = root.querySelector<HTMLElement>("[data-foil]");

  const disposers: Array<() => void> = [startOrbit(root)];

  if (fine.matches) {
    let rect = root.getBoundingClientRect();
    let stale = false;
    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;
    let hovering = false;

    const markStale = (): void => {
      stale = true;
    };

    const paint = (): void => {
      frame = 0;
      if (stale) {
        rect = root.getBoundingClientRect();
        stale = false;
      }
      const x = ((pointerX - rect.left) / rect.width) * 100;
      const y = ((pointerY - rect.top) / rect.height) * 100;
      if (relight) {
        relight.style.setProperty("--lx", toPercent(x));
        relight.style.setProperty("--ly", toPercent(y));
      }
      if (!(foil && hovering)) {
        return;
      }

      foil.style.setProperty("--mx", toPercent(x));
      foil.style.setProperty("--my", toPercent(y));
      foil.style.setProperty("--fx", toPercent(100 - x));
      foil.style.setProperty("--fy", toPercent(100 - y));
    };

    const onMove = (event: Event): void => {
      if (!(event instanceof PointerEvent)) return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (frame === 0) frame = globalThis.requestAnimationFrame(paint);
    };

    const onEnter = (event: Event): void => {
      if (!(event instanceof PointerEvent)) return;
      hovering = true;
      rect = root.getBoundingClientRect();
      stale = false;
      pointerX = event.clientX;
      pointerY = event.clientY;
      paint();
      if (foil) foil.dataset.active = "";
    };

    const onLeave = (): void => {
      hovering = false;
      if (foil) delete foil.dataset.active;
    };

    globalThis.addEventListener("pointermove", onMove, { passive: true });
    globalThis.addEventListener("resize", markStale, { passive: true });
    globalThis.addEventListener("scroll", markStale, { passive: true });
    const resize = new ResizeObserver(markStale);
    resize.observe(root);
    root.addEventListener("pointerenter", onEnter);
    root.addEventListener("pointerleave", onLeave);

    disposers.push(() => {
      globalThis.removeEventListener("pointermove", onMove);
      globalThis.removeEventListener("resize", markStale);
      globalThis.removeEventListener("scroll", markStale);
      resize.disconnect();
      root.removeEventListener("pointerenter", onEnter);
      root.removeEventListener("pointerleave", onLeave);
      if (frame !== 0) globalThis.cancelAnimationFrame(frame);
      frame = 0;
      if (foil) {
        delete foil.dataset.active;
        for (const property of ["--mx", "--my", "--fx", "--fy"]) {
          foil.style.removeProperty(property);
        }
      }
      if (!relight) {
        return;
      }

      relight.style.removeProperty("--lx");
      relight.style.removeProperty("--ly");
    });
  }

  return () => {
    for (const dispose of disposers) dispose();
  };
};

export const initPortraitEffects = (root: HTMLElement): (() => void) => {
  const reduce = globalThis.matchMedia(reducedMotionQuery);
  let stop: (() => void) | undefined;

  const sync = (): void => {
    if (reduce.matches) {
      stop?.();
      stop = undefined;
    } else {
      stop ??= startEffects(root);
    }
  };

  sync();
  reduce.addEventListener("change", sync);

  return () => {
    reduce.removeEventListener("change", sync);
    stop?.();
    stop = undefined;
  };
};
