import { stillQuery } from "@/lib/motion-pause";
import { dialogCellScale } from "@/lib/portrait-dither";
import { createPortraitHalo, type PortraitHalo } from "@/lib/portrait-halo";
import { createPortraitLens } from "@/lib/portrait-lens";
import { prefersLightLoad } from "@/lib/save-data";

const pressMs = 320;
const slopPx = 10;
const clickGuardMs = 450;
const dialogLensRadiusPx = 64;

interface LensWiring {
  blocked?: () => boolean;
  host: HTMLElement;
  radiusPx?: number;
  root: HTMLElement;
  source: string;
}

interface WiredLens {
  dispose: () => void;
  hide: () => void;
  release: () => void;
}

const wireLens = ({
  blocked = (): boolean => false,
  host,
  radiusPx,
  root,
  source,
}: LensWiring): WiredLens => {
  const lens = createPortraitLens(
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
    lens.show(...toUv());
  };

  const hide = (): void => {
    shown = false;
    lens.hide();
  };

  const paint = (): void => {
    frame = 0;
    lens.move(...toUv());
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
    lens.dispose();
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

const startCardLens = (root: HTMLElement): (() => void) => {
  const photo = root.querySelector<HTMLElement>("[data-portrait-photo]");
  const source = photo?.dataset["lensSrc"];
  if (!photo || !source) return () => undefined;
  const wired = wireLens({
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

const startDialogLens = (root: HTMLElement): (() => void) => {
  const dialog = root.parentElement?.querySelector<HTMLDialogElement>(
    "[data-expander-dialog]"
  );
  const lens = dialog?.querySelector<HTMLElement>("[data-expander-lens]");
  const stage = dialog?.querySelector<HTMLElement>("[data-expander-stage]");
  const source = lens?.dataset["lensSrc"];
  if (!dialog || !lens || !stage || !source) return () => undefined;
  let wired: null | WiredLens = null;
  let closing = false;

  const onOpen = (): void => {
    closing = false;
    wired ??= wireLens({
      blocked: () => closing || !dialog.open || isMorphing(stage),
      host: lens,
      radiusPx: dialogLensRadiusPx,
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

const startLens = (root: HTMLElement): (() => void) => {
  if (prefersLightLoad()) return () => undefined;
  const disposers = [startCardLens(root), startDialogLens(root)];
  return () => {
    for (const dispose of disposers) dispose();
  };
};

const startDialogHalo = (
  root: HTMLElement,
  still: () => boolean
): { dispose: () => void; sync: () => void } => {
  const dialog = root.parentElement?.querySelector<HTMLDialogElement>(
    "[data-expander-dialog]"
  );
  const host = dialog?.querySelector<HTMLElement>("[data-expander-halo]");
  if (!dialog || !host)
    return { dispose: () => undefined, sync: () => undefined };
  let halo: null | PortraitHalo = null;

  const onOpen = (): void => {
    halo ??= createPortraitHalo(host, { cellScale: dialogCellScale });
    halo.setStill(still());
  };

  const onClose = (): void => {
    halo?.dispose();
    halo = null;
  };

  root.addEventListener("portrait:open", onOpen);
  dialog.addEventListener("close", onClose);
  if (dialog.open) onOpen();

  return {
    dispose: (): void => {
      root.removeEventListener("portrait:open", onOpen);
      dialog.removeEventListener("close", onClose);
      onClose();
    },
    sync: (): void => {
      halo?.setStill(still());
    },
  };
};

export const initPortraitEffects = (root: HTMLElement): (() => void) => {
  const reduce = stillQuery();
  const halo = createPortraitHalo(root);
  const still = (): boolean => reduce.matches || prefersLightLoad();
  const dialogHalo = startDialogHalo(root, still);
  let stop: (() => void) | undefined;

  const sync = (): void => {
    halo.setStill(still());
    dialogHalo.sync();
    if (reduce.matches) {
      stop?.();
      stop = undefined;
    } else {
      stop ??= startLens(root);
    }
  };

  sync();
  reduce.addEventListener("change", sync);

  return () => {
    reduce.removeEventListener("change", sync);
    stop?.();
    stop = undefined;
    halo.dispose();
    dialogHalo.dispose();
  };
};
