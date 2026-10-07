import { reducedMotionQuery } from "@/lib/media";

interface DownloadLabels {
  downloaded: string;
  downloading: string;
  idle: string;
}

const circumference = 125.66;
const collapsedWidth = 44;
const ease = "cubic-bezier(0.16, 1, 0.3, 1)";
const collapseMs = 220;
const ringStartMs = 220;
const ringMs = 900;
const checkStartMs = 1120;
const checkMs = 200;
const expandStartMs = 1320;
const expandMs = 300;
const resetMs = 2600;
const reducedMs = 2000;

export const initDownloadRing = (
  anchor: HTMLAnchorElement,
  status: HTMLElement,
  labels: DownloadLabels
): (() => void) => {
  const label = anchor.querySelector<HTMLElement>("[data-label]");
  const ring = anchor.querySelector<SVGElement>("[data-ring]");
  const arc = anchor.querySelector<SVGCircleElement>("[data-ring-arc]");
  const downloadIcon = anchor.querySelector<HTMLElement>(
    "[data-icon-download]"
  );
  const checkIcon = anchor.querySelector<HTMLElement>("[data-icon-check]");
  if (!label || !ring || !arc || !downloadIcon || !checkIcon) {
    return () => {};
  }

  const reduce = globalThis.matchMedia(reducedMotionQuery);
  let busy = false;
  let animations: Animation[] = [];
  let timers: Array<ReturnType<typeof setTimeout>> = [];

  const later = (callback: () => void, ms: number): void => {
    timers.push(globalThis.setTimeout(callback, ms));
  };

  const run = (
    element: Element,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions
  ): void => {
    animations.push(
      element.animate(keyframes, { fill: "forwards", ...options })
    );
  };

  const settle = (): void => {
    for (const timer of timers) globalThis.clearTimeout(timer);
    for (const animation of animations) animation.cancel();
    anchor.style.minWidth = "";
    timers = [];
    animations = [];
    label.textContent = labels.idle;
    status.textContent = "";
    delete anchor.dataset.busy;
    busy = false;
  };

  const playReduced = (): void => {
    anchor.style.minWidth = `${anchor.getBoundingClientRect().width}px`;
    label.textContent = labels.downloaded;
    status.textContent = labels.downloaded;
    later(settle, reducedMs);
  };

  const play = (): void => {
    const { width } = anchor.getBoundingClientRect();
    status.textContent = labels.downloading;

    run(anchor, [{ width: `${width}px` }, { width: `${collapsedWidth}px` }], {
      duration: collapseMs,
      easing: ease,
    });
    run(label, [{ opacity: 1 }, { opacity: 0 }], { duration: collapseMs });

    run(ring, [{ opacity: 1 }, { opacity: 1 }], {
      delay: ringStartMs,
      duration: ringMs,
    });
    run(arc, [{ strokeDashoffset: circumference }, { strokeDashoffset: 0 }], {
      delay: ringStartMs,
      duration: ringMs,
      easing: "linear",
    });

    run(ring, [{ opacity: 1 }, { opacity: 0 }], {
      delay: checkStartMs,
      duration: checkMs,
    });
    run(
      downloadIcon,
      [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: "scale(0)" },
      ],
      { delay: checkStartMs, duration: checkMs, easing: ease }
    );
    run(
      checkIcon,
      [
        { opacity: 0, transform: "scale(0)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      { delay: checkStartMs, duration: checkMs, easing: ease }
    );

    run(anchor, [{ width: `${collapsedWidth}px` }, { width: `${width}px` }], {
      delay: expandStartMs,
      duration: expandMs,
      easing: ease,
    });
    run(label, [{ opacity: 0 }, { opacity: 1 }], {
      delay: expandStartMs,
      duration: expandMs,
      easing: ease,
    });

    later(() => {
      label.textContent = labels.downloaded;
      status.textContent = labels.downloaded;
    }, expandStartMs);
    later(settle, resetMs);
  };

  const onClick = (): void => {
    if (busy) return;
    busy = true;
    anchor.dataset.busy = "";
    globalThis.dispatchEvent(new Event("sky:pulse"));
    if (reduce.matches) playReduced();
    else play();
  };

  settle();
  anchor.addEventListener("click", onClick);

  return () => {
    anchor.removeEventListener("click", onClick);
    settle();
  };
};
