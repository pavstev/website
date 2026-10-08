import { reducedMotionQuery } from "@/lib/media";

const openMs = 560;
const closeMs = 300;
const scrimInMs = 420;
const scrimOutMs = 260;
const extraInMs = 520;
const extraDelayMs = 200;
const extraOutMs = 120;
const fadeMs = 140;
const openEasing = "cubic-bezier(0.16, 1, 0.3, 1)";
const closeEasing = "cubic-bezier(0.3, 0, 0.2, 1)";

export interface PortraitExpanderControls {
  close: () => void;
  open: () => void;
  reset: () => void;
}

interface ExpanderParts {
  button: HTMLButtonElement;
  dialog: HTMLDialogElement;
  frame: HTMLElement;
  high: HTMLImageElement;
  largeUrl: string;
  low: HTMLImageElement;
}

const offsetFrom = (from: DOMRect, to: DOMRect): string => {
  const scale = from.width / Math.max(1, to.width);
  const x = from.left + from.width / 2 - (to.left + to.width / 2);
  const y = from.top + from.height / 2 - (to.top + to.height / 2);
  return `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${scale.toFixed(4)})`;
};

export const createPortraitExpander = (
  parts: ExpanderParts
): PortraitExpanderControls => {
  const { button, dialog, frame, high, largeUrl, low } = parts;
  const reduce = globalThis.matchMedia(reducedMotionQuery);
  const photo =
    button.querySelector<HTMLElement>("[data-portrait-photo]") ?? button;
  const scrim = dialog.querySelector<HTMLElement>("[data-expander-scrim]");
  const halo = dialog.querySelector<HTMLElement>("[data-expander-halo]");
  const lens = dialog.querySelector<HTMLElement>("[data-expander-lens]");
  let running: Animation[] = [];
  let closing = false;

  const stopAll = (): void => {
    for (const animation of running) animation.cancel();
    running = [];
  };

  const load = (): void => {
    if (!low.getAttribute("src")) {
      const small = photo.querySelector<HTMLImageElement>("img");
      const placeholder = small?.currentSrc ?? "";
      low.src = placeholder === "" ? (small?.src ?? largeUrl) : placeholder;
    }
    if (!high.getAttribute("src")) high.src = largeUrl;
  };

  const root = document.documentElement;

  const settle = (): void => {
    stopAll();
    closing = false;
    delete button.dataset["expanded"];
    root.style.removeProperty("--scroll-gap");
  };

  const open = (): void => {
    if (dialog.open) return;
    load();
    stopAll();
    closing = false;
    const gap = globalThis.innerWidth - root.clientWidth;
    if (gap > 0) root.style.setProperty("--scroll-gap", `${String(gap)}px`);
    dialog.showModal();
    button.dataset["expanded"] = "";
    button.dispatchEvent(new CustomEvent("portrait:open"));
    globalThis.dispatchEvent(new Event("sky:pulse"));
    if (reduce.matches) {
      running = [
        dialog.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: fadeMs,
          easing: "ease-out",
        }),
      ];
      return;
    }
    const from = offsetFrom(
      photo.getBoundingClientRect(),
      frame.getBoundingClientRect()
    );
    running = [
      frame.animate([{ transform: from }, { transform: "none" }], {
        duration: openMs,
        easing: openEasing,
      }),
    ];
    if (lens) {
      running.push(
        lens.animate(
          [
            { borderRadius: "50%" },
            { borderRadius: getComputedStyle(lens).borderTopLeftRadius },
          ],
          { duration: openMs, easing: openEasing }
        )
      );
    }
    if (scrim) {
      running.push(
        scrim.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: scrimInMs,
          easing: "ease-out",
        })
      );
    }
    if (halo) {
      running.push(
        halo.animate(
          [
            { opacity: 0, scale: "0.96" },
            { opacity: 1, scale: "1" },
          ],
          {
            delay: extraDelayMs,
            duration: extraInMs,
            easing: openEasing,
            fill: "backwards",
          }
        )
      );
    }
  };

  const close = (): void => {
    if (closing || !dialog.open) return;
    closing = true;
    button.dispatchEvent(new CustomEvent("portrait:close"));
    const finish = async (animation: Animation): Promise<void> => {
      try {
        await animation.finished;
      } catch {
        return;
      }
      delete button.dataset["expanded"];
      dialog.close();
    };
    if (reduce.matches) {
      stopAll();
      const fade = dialog.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: fadeMs,
        easing: "ease-in",
        fill: "forwards",
      });
      running = [fade];
      void finish(fade);
      return;
    }
    const current = getComputedStyle(frame).transform;
    const scrimOpacity = scrim ? getComputedStyle(scrim).opacity : "1";
    const haloOpacity = halo ? getComputedStyle(halo).opacity : "1";
    const corner = lens ? getComputedStyle(lens).borderTopLeftRadius : "0px";
    stopAll();
    const target = offsetFrom(
      photo.getBoundingClientRect(),
      frame.getBoundingClientRect()
    );
    const shrink = frame.animate(
      [{ transform: current === "" ? "none" : current }, { transform: target }],
      { duration: closeMs, easing: closeEasing, fill: "forwards" }
    );
    running = [shrink];
    if (lens) {
      running.push(
        lens.animate([{ borderRadius: corner }, { borderRadius: "50%" }], {
          duration: closeMs,
          easing: closeEasing,
          fill: "forwards",
        })
      );
    }
    if (scrim) {
      running.push(
        scrim.animate([{ opacity: scrimOpacity }, { opacity: 0 }], {
          duration: scrimOutMs,
          easing: "ease-in",
          fill: "forwards",
        })
      );
    }
    if (halo) {
      running.push(
        halo.animate([{ opacity: haloOpacity }, { opacity: 0 }], {
          duration: extraOutMs,
          easing: "ease-in",
          fill: "forwards",
        })
      );
    }
    void finish(shrink);
  };

  return { close, open, reset: settle };
};
