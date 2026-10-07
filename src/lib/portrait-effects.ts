import { reducedMotionQuery } from "@/lib/media";
import { createPortraitBead } from "@/lib/portrait-bead";
import { prefersLightLoad } from "@/lib/save-data";

const cometMs = 16_000;
const whisperMs = 44_000;
const breathMs = 7000;
const hoverRate = 4;
const openRate = 14;
const rampMs = 700;
const openHoldMs = 520;
const pressMs = 320;
const slopPx = 10;
const clickGuardMs = 450;

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

const startBead = (root: HTMLElement): (() => void) => {
  const photo = root.querySelector<HTMLElement>("[data-portrait-photo]");
  const source = photo?.dataset["beadSrc"];
  if (!photo || !source || prefersLightLoad()) return () => undefined;
  const bead = createPortraitBead(photo, source);
  let frame = 0;
  let clientX = 0;
  let clientY = 0;
  let startX = 0;
  let startY = 0;
  let touchId: null | number = null;
  let pressing = false;
  let guardUntil = 0;
  let press: ReturnType<typeof globalThis.setTimeout> | undefined;

  const toUv = (): [number, number] => {
    const rect = photo.getBoundingClientRect();
    return [
      (clientX - rect.left) / Math.max(1, rect.width),
      (clientY - rect.top) / Math.max(1, rect.height),
    ];
  };

  const paint = (): void => {
    frame = 0;
    bead.move(...toUv());
  };

  const track = (event: PointerEvent): void => {
    ({ clientX, clientY } = event);
    if (frame === 0) frame = globalThis.requestAnimationFrame(paint);
  };

  const cancelPress = (): void => {
    globalThis.clearTimeout(press);
    press = undefined;
  };

  const onEnter = (event: PointerEvent): void => {
    if (event.pointerType !== "mouse") return;
    ({ clientX, clientY } = event);
    bead.show(...toUv());
  };

  const onLeave = (event: PointerEvent): void => {
    if (event.pointerType === "mouse") bead.hide();
  };

  const onDown = (event: PointerEvent): void => {
    if (touchId !== null || event.pointerType === "mouse") return;
    touchId = event.pointerId;
    ({ clientX, clientY } = event);
    startX = clientX;
    startY = clientY;
    press = globalThis.setTimeout(() => {
      press = undefined;
      pressing = true;
      bead.show(...toUv());
    }, pressMs);
  };

  const onMove = (event: PointerEvent): void => {
    const mouse = event.pointerType === "mouse";
    if (mouse || pressing) {
      if (mouse || event.pointerId === touchId) track(event);
      return;
    }
    if (event.pointerId !== touchId) return;
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > slopPx) {
      cancelPress();
    }
  };

  const onUp = (event: PointerEvent): void => {
    if (event.pointerId !== touchId) return;
    cancelPress();
    touchId = null;
    if (!pressing) return;
    pressing = false;
    bead.hide();
    guardUntil = performance.now() + clickGuardMs;
  };

  const onTouchMove = (event: TouchEvent): void => {
    if (pressing && event.cancelable) event.preventDefault();
  };

  const onContextMenu = (event: Event): void => {
    if (touchId !== null || pressing) event.preventDefault();
  };

  const onClick = (event: Event): void => {
    if (performance.now() > guardUntil) return;
    guardUntil = 0;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const onOpen = (): void => {
    bead.hide();
  };

  root.addEventListener("pointerenter", onEnter);
  root.addEventListener("pointerleave", onLeave);
  root.addEventListener("pointerdown", onDown);
  root.addEventListener("pointermove", onMove);
  root.addEventListener("pointerup", onUp);
  root.addEventListener("pointercancel", onUp);
  root.addEventListener("touchmove", onTouchMove, { passive: false });
  root.addEventListener("contextmenu", onContextMenu);
  root.addEventListener("click", onClick, { capture: true });
  root.addEventListener("portrait:open", onOpen);

  return () => {
    root.removeEventListener("pointerenter", onEnter);
    root.removeEventListener("pointerleave", onLeave);
    root.removeEventListener("pointerdown", onDown);
    root.removeEventListener("pointermove", onMove);
    root.removeEventListener("pointerup", onUp);
    root.removeEventListener("pointercancel", onUp);
    root.removeEventListener("touchmove", onTouchMove);
    root.removeEventListener("contextmenu", onContextMenu);
    root.removeEventListener("click", onClick, { capture: true });
    root.removeEventListener("portrait:open", onOpen);
    cancelPress();
    if (frame !== 0) globalThis.cancelAnimationFrame(frame);
    bead.dispose();
  };
};

const startEffects = (root: HTMLElement): (() => void) => {
  const disposers = [startOrbit(root), startBead(root)];
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
