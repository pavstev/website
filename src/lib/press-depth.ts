import { createListeners } from "./listeners.ts";
import { clamp } from "./math.ts";

export interface PressBox {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
}

export interface PressOrigin {
  x: number;
  y: number;
}

export const pressOrigin = (
  clientX: number,
  clientY: number,
  box: PressBox
): PressOrigin => {
  if (box.width === 0 || box.height === 0) return { x: 0, y: 0 };
  return {
    x: clamp(((clientX - box.left) / box.width) * 2 - 1, -1, 1),
    y: clamp(((clientY - box.top) / box.height) * 2 - 1, -1, 1),
  };
};

export const isInside = (
  clientX: number,
  clientY: number,
  box: PressBox
): boolean =>
  clientX >= box.left &&
  clientX <= box.right &&
  clientY >= box.top &&
  clientY <= box.bottom;

const pressKeys = new Set([" ", "Enter"]);
const releaseKeys = new Set([" ", "Enter", "Escape"]);

export const initPressDepth = (
  scope: HTMLElement,
  selector: string
): (() => void) => {
  const { add, dispose, on } = createListeners();
  let element: HTMLElement | null = null;
  let pointer: null | number = null;

  const release = (): void => {
    if (element) {
      delete element.dataset["pressed"];
      element.style.removeProperty("--press-x");
      element.style.removeProperty("--press-y");
    }
    element = null;
    pointer = null;
  };

  const press = (next: HTMLElement, origin: PressOrigin): void => {
    release();
    element = next;
    next.dataset["pressed"] = "";
    next.style.setProperty("--press-x", origin.x.toFixed(3));
    next.style.setProperty("--press-y", origin.y.toFixed(3));
  };

  const hold = (inside: boolean): void => {
    if (!element) return;
    if (inside) element.dataset["pressed"] = "";
    else delete element.dataset["pressed"];
  };

  on(scope, "pointerdown", (event) => {
    const down = event as PointerEvent;
    if (down.pointerType === "mouse" && down.button !== 0) return;
    const target = (down.target as Element | null)?.closest<HTMLElement>(
      selector
    );
    if (!target) return;
    press(
      target,
      pressOrigin(down.clientX, down.clientY, target.getBoundingClientRect())
    );
    pointer = down.pointerId;
  });

  on(globalThis, "pointermove", (event) => {
    const move = event as PointerEvent;
    if (!element || move.pointerId !== pointer) return;
    hold(isInside(move.clientX, move.clientY, element.getBoundingClientRect()));
  });

  for (const type of ["pointerup", "pointercancel"]) {
    on(globalThis, type, (event) => {
      if ((event as PointerEvent).pointerId === pointer) release();
    });
  }

  on(scope, "keydown", (event) => {
    const key = event as KeyboardEvent;
    if (key.repeat || !pressKeys.has(key.key)) return;
    const target = (key.target as Element | null)?.closest<HTMLElement>(
      selector
    );
    if (!target) return;
    if (key.key === " " && target.tagName === "A") return;
    press(target, { x: 0, y: 0 });
  });

  on(globalThis, "keyup", (event) => {
    const { key } = event as KeyboardEvent;
    if (pointer === null && releaseKeys.has(key)) {
      release();
    }
  });

  on(globalThis, "blur", release);
  on(document, "visibilitychange", () => {
    if (document.hidden) release();
  });
  add(release);

  return dispose;
};
