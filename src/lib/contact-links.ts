import { finePointerQuery, reducedMotionQuery } from "@/lib/media";

const edgeGap = 8;
const tipGap = 10;

interface ContactItem {
  angle: number;
  center: null | { x: number; y: number };
  link: HTMLAnchorElement;
  root: HTMLElement;
  tip: HTMLElement;
}

const overlaps = (a: DOMRect, b: DOMRect, shift: number): boolean =>
  a.left + shift < b.right &&
  a.right + shift > b.left &&
  a.top - edgeGap < b.bottom &&
  a.bottom > b.top;

const placeTip = (
  tip: HTMLElement,
  anchor: HTMLElement,
  avoid: Element[]
): void => {
  tip.style.setProperty("--tip-shift", "0px");
  delete tip.dataset.flip;
  const rect = tip.getBoundingClientRect();
  const root = document.documentElement;
  const limit = root.clientWidth - edgeGap;
  let shift = 0;
  if (rect.left < edgeGap) shift = edgeGap - rect.left;
  else if (rect.right > limit) shift = limit - rect.right;
  tip.style.setProperty("--tip-shift", `${Math.round(shift)}px`);
  const blocked = avoid.some((element) =>
    overlaps(rect, element.getBoundingClientRect(), shift)
  );
  const roomAbove = rect.top - edgeGap;
  const roomBelow =
    root.clientHeight -
    edgeGap -
    (anchor.getBoundingClientRect().bottom + tipGap + rect.height);
  const flip =
    roomAbove < 0 ? roomBelow > roomAbove : blocked && roomBelow >= 0;
  if (flip) tip.dataset.flip = "";
};

export const initContactLinks = (list: HTMLElement): (() => void) => {
  const fine = globalThis.matchMedia(finePointerQuery);
  const reduce = globalThis.matchMedia(reducedMotionQuery);
  const items: ContactItem[] = [];
  for (const root of list.querySelectorAll<HTMLElement>(":scope > li")) {
    const link = root.querySelector<HTMLAnchorElement>("a");
    const tip = root.querySelector<HTMLElement>("[role='tooltip']");
    if (link && tip) {
      items.push({ angle: 315, center: null, link, root, tip });
    }
  }
  const avoid = [
    ...(list.parentElement?.querySelectorAll(":scope > :is(a, button)") ?? []),
    ...(list
      .closest("[data-card]")
      ?.querySelectorAll(":scope > [data-blur-in]") ?? []),
  ];
  const disposers: Array<() => void> = [];

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

  for (const item of items) {
    on(item.root, "pointerenter", (event) => {
      if ((event as PointerEvent).pointerType !== "mouse" || !fine.matches) {
        return;
      }
      delete item.root.dataset.dismissed;
      placeTip(item.tip, item.link, avoid);
    });
    on(item.root, "pointerleave", () => {
      if (!item.link.matches(":focus")) delete item.root.dataset.dismissed;
    });
    on(item.link, "focus", () => {
      delete item.root.dataset.dismissed;
      placeTip(item.tip, item.link, avoid);
    });
    on(item.link, "blur", () => {
      if (!item.root.matches(":hover")) delete item.root.dataset.dismissed;
    });
  }

  let aimFrame = 0;
  const aim = { x: 0, y: 0 };

  const paintAim = (): void => {
    aimFrame = 0;
    for (const item of items) {
      if (!item.center) {
        const box = item.link.getBoundingClientRect();
        item.center = {
          x: box.left + box.width / 2,
          y: box.top + box.height / 2,
        };
      }
      const target =
        (Math.atan2(aim.x - item.center.x, item.center.y - aim.y) * 180) /
        Math.PI;
      const turn = ((((target - item.angle) % 360) + 540) % 360) - 180;
      item.angle += turn;
      item.link.style.setProperty("--ma", `${item.angle.toFixed(1)}deg`);
    }
  };

  const forgetCenters = (): void => {
    for (const item of items) item.center = null;
  };

  on(globalThis, "pointermove", (event) => {
    const pointer = event as PointerEvent;
    if (pointer.pointerType !== "mouse" || !fine.matches || reduce.matches) {
      return;
    }
    aim.x = pointer.clientX;
    aim.y = pointer.clientY;
    if (!aimFrame) aimFrame = requestAnimationFrame(paintAim);
  });
  on(globalThis, "scroll", forgetCenters);

  let resizeFrame = 0;
  on(globalThis, "resize", () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      for (const item of items) {
        item.center = null;
        if (item.root.matches(":hover") || item.link.matches(":focus")) {
          placeTip(item.tip, item.link, avoid);
        }
      }
    });
  });

  on(document, "keydown", (event) => {
    if ((event as KeyboardEvent).key !== "Escape") return;
    for (const item of items) {
      if (item.root.matches(":hover") || item.link.matches(":focus-visible")) {
        item.root.dataset.dismissed = "";
      }
    }
  });

  return () => {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    if (aimFrame) cancelAnimationFrame(aimFrame);
    for (const dispose of disposers) dispose();
    for (const item of items) {
      delete item.root.dataset.dismissed;
      item.link.style.removeProperty("--ma");
    }
  };
};
