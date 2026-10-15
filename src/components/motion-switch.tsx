import { type ReactElement, useSyncExternalStore } from "react";

import { en } from "@/lib/i18n";
import {
  isMotionPaused,
  setMotionPaused,
  subscribeMotionPause,
} from "@/lib/motion-pause";

export const MotionSwitch = (): ReactElement => {
  const paused = useSyncExternalStore(
    subscribeMotionPause,
    isMotionPaused,
    () => false
  );

  return (
    <span className="motion-switch">
      <span aria-hidden="true"> · </span>
      <button
        className="motion-switch-button focus-ring"
        onClick={() => {
          setMotionPaused(!paused);
        }}
        type="button"
      >
        {paused ? en.motion.start : en.motion.stop}
      </button>
    </span>
  );
};
