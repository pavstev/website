import { finePointerQuery } from "@/lib/media";
import { stillQuery } from "@/lib/motion-pause";

const edgeGap = 8;
const tipGap = 10;

interface AimTarget {
  angle: number;
  center: null | { x: number; y: number };
  link: HTMLElement;
}

interface ContactItem extends AimTarget {
  link: HTMLAnchorElement;
  root: HTMLElement;
  tip: HTMLElement;
}

interface Obstacle {
  element: Element;
  weight: number;
}

interface Span {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

const offscreenCost = 4;

const overlaps = (a: Span, b: DOMRect): boolean =>
  a.left < b.right &&
  a.right > b.left &&
  a.top - edgeGap < b.bottom &&
  a.bottom + edgeGap > b.top;

const costOf = (span: Span, room: number, avoid: Obstacle[]): number =>
  (room < 0 ? offscreenCost : 0) +
  Math.max(
    0,
    ...avoid
      .filter(({ element }) => overlaps(span, element.getBoundingClientRect()))
      .map(({ weight }) => weight)
  );

const placeTip = (
  tip: HTMLElement,
  anchor: HTMLElement,
  avoid: Obstacle[]
): void => {
  tip.style.setProperty("--tip-shift", "0px");
  delete tip.dataset["flip"];
  const rect = tip.getBoundingClientRect();
  const root = document.documentElement;
  const limit = root.clientWidth - edgeGap;
  let shift = 0;
  if (rect.left < edgeGap) shift = edgeGap - rect.left;
  else if (rect.right > limit) shift = limit - rect.right;
  tip.style.setProperty("--tip-shift", `${String(Math.round(shift))}px`);
  const left = rect.left + shift;
  const right = rect.right + shift;
  const belowTop = anchor.getBoundingClientRect().bottom + tipGap;
  const roomAbove = rect.top - edgeGap;
  const roomBelow = root.clientHeight - edgeGap - (belowTop + rect.height);
  const above = costOf(
    { bottom: rect.bottom, left, right, top: rect.top },
    roomAbove,
    avoid
  );
  const below = costOf(
    { bottom: belowTop + rect.height, left, right, top: belowTop },
    roomBelow,
    avoid
  );
  const flip =
    below < above ||
    (below === above && roomAbove < 0 && roomBelow > roomAbove);
  if (flip) tip.dataset["flip"] = "";
};

export const initContactLinks = (list: HTMLElement): (() => void) => {
  const fine = globalThis.matchMedia(finePointerQuery);
  const reduce = stillQuery();
  const row = list.parentElement ?? list;
  const items: ContactItem[] = [];
  for (const root of row.querySelectorAll<HTMLElement>(
    ":is(.download-item, .contact-item)"
  )) {
    const link = root.querySelector<HTMLAnchorElement>(":scope > a");
    const tip = root.querySelector<HTMLElement>(":scope > [role='tooltip']");
    if (link && tip) {
      items.push({ angle: 315, center: null, link, root, tip });
    }
  }
  const targets: AimTarget[] = items;
  const avoid: Obstacle[] = [
    ...[...row.querySelectorAll(":is(.download-pill, .contact-link)")].map(
      (element) => ({ element, weight: 2 })
    ),
    ...[
      ...(list
        .closest("[data-card]")
        ?.querySelectorAll(":scope > [data-blur-in]") ?? []),
    ].map((element) => ({ element, weight: 1 })),
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
      delete item.root.dataset["dismissed"];
      placeTip(item.tip, item.link, avoid);
    });
    on(item.root, "pointerleave", () => {
      if (!item.link.matches(":focus")) delete item.root.dataset["dismissed"];
    });
    on(item.link, "focus", () => {
      delete item.root.dataset["dismissed"];
      placeTip(item.tip, item.link, avoid);
    });
    on(item.link, "blur", () => {
      if (!item.root.matches(":hover")) delete item.root.dataset["dismissed"];
    });
  }

  let aimFrame = 0;
  const aim = { x: 0, y: 0 };

  const paintAim = (): void => {
    aimFrame = 0;
    for (const item of targets) {
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
    for (const item of targets) item.center = null;
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
      for (const item of targets) item.center = null;
      for (const item of items) {
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
        item.root.dataset["dismissed"] = "";
      }
    }
  });

  return () => {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    if (aimFrame) cancelAnimationFrame(aimFrame);
    for (const dispose of disposers) dispose();
    for (const item of items) delete item.root.dataset["dismissed"];
    for (const item of targets) item.link.style.removeProperty("--ma");
  };
};
