import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  type Placement,
  shift,
  size,
} from "@floating-ui/dom";

import { finePointerQuery } from "@/lib/media";

const edge = 12;
const openDelayMs = 120;
const closeDelayMs = 220;

const placementOf = (panel: HTMLElement): Placement => {
  const value = panel.dataset["placement"];
  return value === "top" || value === "bottom-start" ? value : "bottom";
};

const attach = (
  trigger: HTMLElement,
  panel: HTMLElement,
  wide: MediaQueryList
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
    void computePosition(trigger, panel, {
      middleware: [
        offset(10),
        flip({ padding: edge }),
        shift({ padding: edge }),
        size({
          apply: ({ availableHeight }) => {
            panel.style.maxHeight = `${String(Math.max(160, Math.floor(availableHeight)))}px`;
          },
          padding: edge,
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
    trigger.toggleAttribute("data-open", open);
    if (open && (wide.matches || panel.dataset["anchored"] === "always")) {
      panel.dataset["floating"] = "";
      stop = autoUpdate(trigger, panel, place);
    } else {
      release();
    }
  };
  panel.addEventListener("toggle", onToggle);
  return () => {
    panel.removeEventListener("toggle", onToggle);
    delete trigger.dataset["open"];
    release();
  };
};

const hoverOpen = (
  trigger: HTMLElement,
  panel: HTMLElement,
  fine: MediaQueryList
): (() => void) => {
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
  const clear = (): void => {
    if (timer !== undefined) globalThis.clearTimeout(timer);
    timer = undefined;
  };
  const open = (): void => {
    if (!fine.matches) return;
    clear();
    timer = globalThis.setTimeout(() => {
      if (!panel.matches(":popover-open")) panel.showPopover();
    }, openDelayMs);
  };
  const close = (): void => {
    if (!fine.matches) return;
    clear();
    timer = globalThis.setTimeout(() => {
      if (panel.matches(":popover-open")) panel.hidePopover();
    }, closeDelayMs);
  };
  for (const target of [trigger, panel]) {
    target.addEventListener("pointerenter", open);
    target.addEventListener("pointerleave", close);
  }
  return () => {
    clear();
    for (const target of [trigger, panel]) {
      target.removeEventListener("pointerenter", open);
      target.removeEventListener("pointerleave", close);
    }
  };
};

export const initAnchoredPopovers = (root: ParentNode): (() => void) => {
  const wide = globalThis.matchMedia("(min-width: 40rem)");
  const fine = globalThis.matchMedia(finePointerQuery);
  const disposers: Array<() => void> = [];
  for (const panel of root.querySelectorAll<HTMLElement>(
    "[popover][data-anchored]"
  )) {
    const trigger = root.querySelector<HTMLElement>(
      `[popovertarget="${CSS.escape(panel.id)}"]:not([popovertargetaction="hide"])`
    );
    if (!trigger) continue;
    disposers.push(attach(trigger, panel, wide));
    if (Object.hasOwn(trigger.dataset, "hoverOpen")) {
      disposers.push(hoverOpen(trigger, panel, fine));
    }
  }
  return () => {
    for (const dispose of disposers) dispose();
  };
};
