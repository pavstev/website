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
const shiftReach = 0.35;

interface Blocker {
  box: DOMRect;
  weight: number;
}

interface Placement {
  flip: boolean;
  score: number;
  shift: number;
}

const overlaps = (a: Span, b: DOMRect): boolean =>
  a.left < b.right &&
  a.right > b.left &&
  a.top - edgeGap < b.bottom &&
  a.bottom + edgeGap > b.top;

const costOf = (span: Span, room: number, blockers: Blocker[]): number =>
  (room < 0 ? offscreenCost : 0) +
  Math.max(
    0,
    ...blockers
      .filter(({ box }) => overlaps(span, box))
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
  let base = 0;
  if (rect.left < edgeGap) base = edgeGap - rect.left;
  else if (rect.right > limit) base = limit - rect.right;
  const reach = rect.width * shiftReach;
  const fits = (shift: number): boolean =>
    Math.abs(shift) <= reach &&
    rect.left + shift >= edgeGap &&
    rect.right + shift <= limit;
  const blockers: Blocker[] = avoid.map(({ element, weight }) => ({
    box: element.getBoundingClientRect(),
    weight,
  }));
  const belowTop = anchor.getBoundingClientRect().bottom + tipGap;
  const roomAbove = rect.top - edgeGap;
  const roomBelow = root.clientHeight - edgeGap - (belowTop + rect.height);
  const preferBelow = roomAbove < 0 && roomBelow > roomAbove;
  let best: Placement = { flip: false, score: Infinity, shift: base };
  for (const flip of [false, true]) {
    const top = flip ? belowTop : rect.top;
    const bottom = top + rect.height;
    const shifts = [base];
    for (const { box } of blockers) {
      if (top - edgeGap >= box.bottom || bottom + edgeGap <= box.top) continue;
      shifts.push(
        box.right + edgeGap - rect.left,
        box.left - edgeGap - rect.right
      );
    }
    for (const shift of shifts) {
      if (shift !== base && !fits(shift)) continue;
      const cost = costOf(
        { bottom, left: rect.left + shift, right: rect.right + shift, top },
        flip ? roomBelow : roomAbove,
        blockers
      );
      const score =
        cost * rect.width +
        Math.abs(shift - base) +
        (flip === preferBelow ? 0 : 0.5);
      if (score < best.score) best = { flip, score, shift };
    }
  }
  tip.style.setProperty("--tip-shift", `${String(Math.round(best.shift))}px`);
  if (best.flip) tip.dataset["flip"] = "";
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
        ?.querySelectorAll(":scope > [data-blur-in], .repo-heading") ?? []),
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
