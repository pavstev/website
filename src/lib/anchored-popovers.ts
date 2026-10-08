import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  type Padding,
  type Placement,
  shift,
  size,
} from "@floating-ui/dom";

import { finePointerQuery } from "./media.ts";

const edge = 12;

const floatingQuery = "(min-width: 40rem) and (min-height: 34rem)";

const safePadding = (panel: HTMLElement): Padding => {
  const style = getComputedStyle(panel);
  const side = (name: string): number =>
    edge +
    (Number(style.getPropertyValue(`--safe-${name}`).replace("px", "")) || 0);
  return {
    bottom: side("bottom"),
    left: side("left"),
    right: side("right"),
    top: side("top"),
  };
};

interface HoverTiming {
  closeMs: number;
  openMs: number;
  pin: boolean;
}

const timingOf = (trigger: HTMLElement): HoverTiming =>
  trigger.dataset["hoverOpen"] === "pin"
    ? { closeMs: 300, openMs: 300, pin: true }
    : { closeMs: 220, openMs: 120, pin: false };

type Track = typeof autoUpdate;

const floats = (panel: HTMLElement, wide: MediaQueryList): boolean =>
  wide.matches || panel.dataset["anchored"] === "always";

const placementOf = (panel: HTMLElement): Placement => {
  const value = panel.dataset["placement"];
  return value === "top" || value === "bottom-start" ? value : "bottom";
};

const attach = (
  trigger: HTMLElement,
  panel: HTMLElement,
  wide: MediaQueryList,
  track: Track
): (() => void) => {
  let stop: (() => void) | undefined;
  const release = (): void => {
    stop?.();
    stop = undefined;
    delete panel.dataset["floating"];
    panel.style.removeProperty("left");
    panel.style.removeProperty("top");
    panel.style.removeProperty("max-height");
  };
  const place = (): void => {
    const padding = safePadding(panel);
    void computePosition(trigger, panel, {
      middleware: [
        offset(10),
        flip({ padding }),
        shift({ padding }),
        size({
          apply: ({ availableHeight }) => {
            panel.style.maxHeight = `${String(Math.max(160, Math.floor(availableHeight)))}px`;
          },
          padding,
        }),
      ],
      placement: placementOf(panel),
      strategy: "fixed",
    }).then(({ placement, x, y }) => {
      panel.style.left = `${String(Math.round(x))}px`;
      panel.style.top = `${String(Math.round(y))}px`;
      panel.dataset["side"] = placement.split("-", 1)[0] ?? "bottom";
    });
  };
  const onToggle = (event: Event): void => {
    const open = (event as ToggleEvent).newState === "open";
    if (open && floats(panel, wide)) {
      panel.dataset["floating"] = "";
      stop = track(trigger, panel, place);
    } else {
      release();
    }
  };
  const onBeforeToggle = (event: Event): void => {
    const open = (event as ToggleEvent).newState === "open";
    trigger.toggleAttribute("data-open", open);
    trigger.setAttribute("aria-expanded", String(open));
  };
  panel.addEventListener("beforetoggle", onBeforeToggle);
  panel.addEventListener("toggle", onToggle);
  return () => {
    panel.removeEventListener("beforetoggle", onBeforeToggle);
    panel.removeEventListener("toggle", onToggle);
    delete trigger.dataset["open"];
    release();
  };
};

const fromMouse = (event: MouseEvent): boolean => {
  const { pointerType } = event as Partial<PointerEvent>;
  return pointerType === undefined ? event.detail > 0 : pointerType === "mouse";
};

const hoverOpen = (
  trigger: HTMLElement,
  panel: HTMLElement,
  fine: MediaQueryList,
  wide: MediaQueryList
): (() => void) => {
  const { closeMs, openMs, pin } = timingOf(trigger);
  const active = (): boolean => fine.matches && floats(panel, wide);
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let pinned = false;
  const clear = (): void => {
    if (timer !== undefined) globalThis.clearTimeout(timer);
    timer = undefined;
  };
  const isOpen = (): boolean => panel.matches(":popover-open");
  const open = (): void => {
    if (!active()) return;
    clear();
    timer = globalThis.setTimeout(() => {
      if (!isOpen()) panel.showPopover();
    }, openMs);
  };
  const close = (): void => {
    if (pinned || !active() || panel.matches(":focus-within")) return;
    clear();
    timer = globalThis.setTimeout(() => {
      if (isOpen()) panel.hidePopover();
    }, closeMs);
  };
  const onClick = (event: MouseEvent): void => {
    if (!pin || !active() || !fromMouse(event)) return;
    event.preventDefault();
    clear();
    if (pinned && isOpen()) {
      panel.hidePopover();
      return;
    }
    pinned = true;
    if (!isOpen()) panel.showPopover();
  };
  const onToggle = (event: Event): void => {
    if ((event as ToggleEvent).newState !== "closed") return;
    pinned = false;
    clear();
  };
  for (const target of [trigger, panel]) {
    target.addEventListener("pointerenter", open);
    target.addEventListener("pointerleave", close);
  }
  trigger.addEventListener("click", onClick);
  panel.addEventListener("beforetoggle", onToggle);
  return () => {
    clear();
    for (const target of [trigger, panel]) {
      target.removeEventListener("pointerenter", open);
      target.removeEventListener("pointerleave", close);
    }
    trigger.removeEventListener("click", onClick);
    panel.removeEventListener("beforetoggle", onToggle);
  };
};

const focusOnActivate = (
  trigger: HTMLElement,
  panel: HTMLElement
): (() => void) => {
  let pending = false;
  const onClick = (): void => {
    pending = !panel.matches(":popover-open");
  };
  const onToggle = (event: Event): void => {
    if (!pending) return;
    pending = false;
    if ((event as ToggleEvent).newState !== "open") return;
    panel
      .querySelector<HTMLElement>("[data-initial-focus]")
      ?.focus({ preventScroll: true });
  };
  trigger.addEventListener("click", onClick);
  panel.addEventListener("toggle", onToggle);
  return () => {
    trigger.removeEventListener("click", onClick);
    panel.removeEventListener("toggle", onToggle);
  };
};

export const initAnchoredPopovers = (
  root: ParentNode,
  track: Track = autoUpdate
): (() => void) => {
  const wide = globalThis.matchMedia(floatingQuery);
  const fine = globalThis.matchMedia(finePointerQuery);
  const disposers: Array<() => void> = [];
  for (const panel of root.querySelectorAll<HTMLElement>(
    "[popover][data-anchored]"
  )) {
    const trigger = root.querySelector<HTMLElement>(
      `[popovertarget="${CSS.escape(panel.id)}"]:not([popovertargetaction="hide"])`
    );
    if (!trigger) continue;
    disposers.push(attach(trigger, panel, wide, track));
    if (Object.hasOwn(trigger.dataset, "hoverOpen")) {
      disposers.push(hoverOpen(trigger, panel, fine, wide));
    }
    if (trigger.dataset["hoverOpen"] === "pin") {
      disposers.push(focusOnActivate(trigger, panel));
    }
  }
  return () => {
    for (const dispose of disposers) dispose();
  };
};
