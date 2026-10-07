import { finePointerQuery, reducedMotionQuery } from "@/lib/media";

const proximitySelector = "[data-proximity] > li > a";
const glowSelector = "[data-cursor-glow]";
const proximityRadius = 80;
const proximityGain = 0.18;

interface ProximityTarget {
  cx: number;
  cy: number;
  element: HTMLElement;
  value: string;
}

const startCursorEffects = (): (() => void) => {
  const glow = document.querySelector<HTMLElement>(glowSelector);
  const targets: ProximityTarget[] = [
    ...document.querySelectorAll<HTMLElement>(proximitySelector),
  ].map((element) => ({ cx: 0, cy: 0, element, value: "" }));
  const lists = new Set<Element>();
  for (const target of targets) {
    const list = target.element.closest("[data-proximity]");
    if (list) lists.add(list);
    if (list?.parentElement) lists.add(list.parentElement);
  }

  let stale = true;
  let frame = 0;
  let pointerX = 0;
  let pointerY = 0;
  let seen = false;
  let disposed = false;

  const refresh = (): void => {
    for (const target of targets) {
      const rect = target.element.getBoundingClientRect();
      target.cx = rect.left + rect.width / 2;
      target.cy = rect.top + rect.height / 2;
    }
    stale = false;
  };

  const setValue = (target: ProximityTarget, value: string): void => {
    if (target.value === value) return;
    target.value = value;
    target.element.style.transform = value;
  };

  const resetProximity = (): void => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    for (const target of targets) setValue(target, "");
  };

  const step = (): void => {
    frame = 0;
    if (stale) refresh();
    for (const target of targets) {
      const distance = Math.hypot(pointerX - target.cx, pointerY - target.cy);
      setValue(
        target,
        distance < proximityRadius
          ? `scale(${(1 + proximityGain * (1 - distance / proximityRadius)).toFixed(3)})`
          : ""
      );
    }
  };

  const restep = (): void => {
    stale = true;
    if (!seen || disposed || frame || targets.length === 0) return;
    frame = requestAnimationFrame(step);
  };

  const onPointerMove = (event: Event): void => {
    const pointer = event as PointerEvent;
    if (glow) {
      glow.style.opacity = "1";
      glow.style.transform = `translate3d(${pointer.clientX - 160}px, ${pointer.clientY - 160}px, 0)`;
    }
    if (targets.length === 0) return;
    pointerX = pointer.clientX;
    pointerY = pointer.clientY;
    seen = true;
    if (!frame) frame = requestAnimationFrame(step);
  };

  const onLeave = (): void => {
    if (glow) glow.style.opacity = "0";
    seen = false;
    resetProximity();
  };

  const root = document.documentElement;
  const observer = new ResizeObserver(restep);
  for (const list of lists) observer.observe(list);
  globalThis.addEventListener("pointermove", onPointerMove, { passive: true });
  globalThis.addEventListener("resize", restep, { passive: true });
  globalThis.addEventListener("scroll", restep, { passive: true });
  void document.fonts.ready.then(restep);
  document.addEventListener("animationend", restep, { capture: true });
  globalThis.addEventListener("load", restep);
  root.addEventListener("mouseleave", onLeave);

  return (): void => {
    disposed = true;
    observer.disconnect();
    globalThis.removeEventListener("pointermove", onPointerMove);
    globalThis.removeEventListener("resize", restep);
    globalThis.removeEventListener("scroll", restep);
    document.removeEventListener("animationend", restep, true);
    globalThis.removeEventListener("load", restep);
    root.removeEventListener("mouseleave", onLeave);
    onLeave();
  };
};

export const initCursorEffects = (): (() => void) => {
  const fine = globalThis.matchMedia(finePointerQuery);
  const reduce = globalThis.matchMedia(reducedMotionQuery);
  let stop: (() => void) | undefined;

  const sync = (): void => {
    if (fine.matches && !reduce.matches) {
      stop ??= startCursorEffects();
    } else {
      stop?.();
      stop = undefined;
    }
  };

  sync();
  fine.addEventListener("change", sync);
  reduce.addEventListener("change", sync);

  return () => {
    fine.removeEventListener("change", sync);
    reduce.removeEventListener("change", sync);
    stop?.();
    stop = undefined;
  };
};

export const initPointerLight = (scope: HTMLElement): (() => void) => {
  const fine = globalThis.matchMedia(finePointerQuery);
  const reduce = globalThis.matchMedia(reducedMotionQuery);
  const elements = [
    ...scope.querySelectorAll<HTMLElement>("[data-pointer-light]"),
  ];
  const rects = new Map<HTMLElement, DOMRect | null>();
  const disposers: Array<() => void> = [];

  const clear = (element: HTMLElement): void => {
    element.style.removeProperty("--mx");
    element.style.removeProperty("--my");
  };

  const on = (
    target: EventTarget,
    type: string,
    listener: (event: Event) => void
  ): void => {
    target.addEventListener(type, listener, { passive: true });
    disposers.push(() => {
      target.removeEventListener(type, listener);
    });
  };

  for (const element of elements) {
    on(element, "pointerenter", () => {
      rects.set(element, null);
    });
    on(element, "pointermove", (event) => {
      const pointer = event as PointerEvent;
      if (
        !rects.has(element) ||
        pointer.pointerType !== "mouse" ||
        !fine.matches ||
        reduce.matches
      )
        return;
      const rect = rects.get(element) ?? element.getBoundingClientRect();
      rects.set(element, rect);
      const x = ((pointer.clientX - rect.left) / rect.width) * 100;
      const y = ((pointer.clientY - rect.top) / rect.height) * 100;
      element.style.setProperty("--mx", `${x.toFixed(1)}%`);
      element.style.setProperty("--my", `${y.toFixed(1)}%`);
    });
    on(element, "pointerleave", () => {
      rects.delete(element);
      clear(element);
    });
  }

  on(globalThis, "scroll", () => {
    for (const element of rects.keys()) rects.set(element, null);
  });

  return () => {
    for (const dispose of disposers) dispose();
    for (const element of elements) clear(element);
    rects.clear();
  };
};
