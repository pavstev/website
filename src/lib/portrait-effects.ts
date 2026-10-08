import { stillQuery } from "@/lib/motion-pause";
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
const dialogBeadRadiusPx = 64;

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

interface BeadWiring {
  blocked?: () => boolean;
  host: HTMLElement;
  radiusPx?: number;
  root: HTMLElement;
  source: string;
}

interface WiredBead {
  dispose: () => void;
  hide: () => void;
  release: () => void;
}

const wireBead = ({
  blocked = (): boolean => false,
  host,
  radiusPx,
  root,
  source,
}: BeadWiring): WiredBead => {
  const bead = createPortraitBead(
    host,
    source,
    radiusPx === undefined ? {} : { radiusPx }
  );
  let frame = 0;
  let clientX = 0;
  let clientY = 0;
  let startX = 0;
  let startY = 0;
  let touchId: null | number = null;
  let pressing = false;
  let shown = false;
  let guardUntil = 0;
  let press: ReturnType<typeof globalThis.setTimeout> | undefined;

  const toUv = (): [number, number] => {
    const rect = host.getBoundingClientRect();
    return [
      (clientX - rect.left) / Math.max(1, rect.width),
      (clientY - rect.top) / Math.max(1, rect.height),
    ];
  };

  const show = (): void => {
    if (blocked()) return;
    shown = true;
    bead.show(...toUv());
  };

  const hide = (): void => {
    shown = false;
    bead.hide();
  };

  const paint = (): void => {
    frame = 0;
    bead.move(...toUv());
  };

  const track = (event: PointerEvent): void => {
    ({ clientX, clientY } = event);
    if (!shown) {
      if (event.pointerType === "mouse") show();
      return;
    }
    if (frame === 0) frame = globalThis.requestAnimationFrame(paint);
  };

  const cancelPress = (): void => {
    globalThis.clearTimeout(press);
    press = undefined;
  };

  const onEnter = (event: PointerEvent): void => {
    if (event.pointerType !== "mouse") return;
    ({ clientX, clientY } = event);
    show();
  };

  const onLeave = (event: PointerEvent): void => {
    if (event.pointerType === "mouse") hide();
  };

  const onDown = (event: PointerEvent): void => {
    if (touchId !== null || event.pointerType === "mouse") return;
    touchId = event.pointerId;
    ({ clientX, clientY } = event);
    startX = clientX;
    startY = clientY;
    press = globalThis.setTimeout(() => {
      press = undefined;
      if (blocked()) return;
      pressing = true;
      show();
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
    hide();
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

  const release = (): void => {
    cancelPress();
    if (frame !== 0) globalThis.cancelAnimationFrame(frame);
    frame = 0;
    touchId = null;
    pressing = false;
    shown = false;
    bead.dispose();
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

  return {
    dispose: (): void => {
      root.removeEventListener("pointerenter", onEnter);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerup", onUp);
      root.removeEventListener("pointercancel", onUp);
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("contextmenu", onContextMenu);
      root.removeEventListener("click", onClick, { capture: true });
      release();
    },
    hide,
    release,
  };
};

const isMorphing = (element: Element): boolean =>
  element
    .getAnimations()
    .some((animation) => animation.playState === "running");

const startCardBead = (root: HTMLElement): (() => void) => {
  const photo = root.querySelector<HTMLElement>("[data-portrait-photo]");
  const source = photo?.dataset["beadSrc"];
  if (!photo || !source) return () => undefined;
  const wired = wireBead({
    blocked: () => root.dataset["expanded"] !== undefined,
    host: photo,
    root,
    source,
  });
  root.addEventListener("portrait:open", wired.release);
  return () => {
    root.removeEventListener("portrait:open", wired.release);
    wired.dispose();
  };
};

const startDialogBead = (root: HTMLElement): (() => void) => {
  const dialog = root.parentElement?.querySelector<HTMLDialogElement>(
    "[data-expander-dialog]"
  );
  const lens = dialog?.querySelector<HTMLElement>("[data-expander-lens]");
  const stage = dialog?.querySelector<HTMLElement>("[data-expander-stage]");
  const source = lens?.dataset["beadSrc"];
  if (!dialog || !lens || !stage || !source) return () => undefined;
  let wired: null | WiredBead = null;
  let closing = false;

  const onOpen = (): void => {
    closing = false;
    wired ??= wireBead({
      blocked: () => closing || !dialog.open || isMorphing(stage),
      host: lens,
      radiusPx: dialogBeadRadiusPx,
      root: lens,
      source,
    });
  };

  const onClosing = (): void => {
    closing = true;
    wired?.hide();
  };

  const onClose = (): void => {
    wired?.dispose();
    wired = null;
  };

  root.addEventListener("portrait:open", onOpen);
  root.addEventListener("portrait:close", onClosing);
  dialog.addEventListener("close", onClose);
  if (dialog.open) onOpen();

  return () => {
    root.removeEventListener("portrait:open", onOpen);
    root.removeEventListener("portrait:close", onClosing);
    dialog.removeEventListener("close", onClose);
    onClose();
  };
};

const startBead = (root: HTMLElement): (() => void) => {
  if (prefersLightLoad()) return () => undefined;
  const disposers = [startCardBead(root), startDialogBead(root)];
  return () => {
    for (const dispose of disposers) dispose();
  };
};

const startEffects = (root: HTMLElement): (() => void) => {
  const disposers = [startOrbit(root), startBead(root)];
  return () => {
    for (const dispose of disposers) dispose();
  };
};

export const initPortraitEffects = (root: HTMLElement): (() => void) => {
  const reduce = stillQuery();
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
