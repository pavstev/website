import {
  isMotionPaused,
  setMotionPaused,
  subscribeMotionPause,
} from "@/lib/motion-pause";

const trackSelector = "[data-motion-switch]";

const sync = (): void => {
  const checked = String(!isMotionPaused());
  for (const track of document.querySelectorAll(trackSelector)) {
    track.setAttribute("aria-checked", checked);
  }
};

export const watchMotionSwitches = (): void => {
  sync();
  subscribeMotionPause(sync);
  document.addEventListener("astro:page-load", sync);
  document.addEventListener("click", (event) => {
    if (
      event.target instanceof Element &&
      event.target.closest(trackSelector)
    ) {
      setMotionPaused(!isMotionPaused());
    }
  });
};
