import { type ReactElement, useId, useSyncExternalStore } from "react";

import { en } from "@/lib/i18n";
import {
  isMotionPaused,
  setMotionPaused,
  subscribeMotionPause,
} from "@/lib/motion-pause";

interface MotionSwitchProps {
  hint?: boolean;
}

export const MotionSwitch = ({
  hint = false,
}: MotionSwitchProps): ReactElement => {
  const paused = useSyncExternalStore(
    subscribeMotionPause,
    isMotionPaused,
    () => false
  );
  const labelId = useId();
  const hintId = useId();

  return (
    <span className="motion-switch">
      <span className="motion-switch-text">
        <span id={labelId}>{en.motion.label}</span>
        {hint && (
          <span className="motion-switch-hint" id={hintId}>
            {en.motion.hint}
          </span>
        )}
      </span>
      <button
        aria-checked={!paused}
        aria-describedby={hint ? hintId : undefined}
        aria-labelledby={labelId}
        className="motion-switch-track focus-ring"
        onClick={() => {
          setMotionPaused(!paused);
        }}
        role="switch"
        type="button"
      >
        <span aria-hidden="true" className="motion-switch-thumb" />
      </button>
    </span>
  );
};
