"use client";

import {
  type ReactElement,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { Icon } from "@/components/icon";
import { en } from "@/lib/i18n";
import {
  isMotionPaused,
  setMotionPaused,
  subscribeMotionPause,
} from "@/lib/motion-pause";

export const MotionToggle = (): ReactElement => {
  const paused = useSyncExternalStore(
    subscribeMotionPause,
    isMotionPaused,
    () => false
  );
  const [dismissed, setDismissed] = useState(false);
  const itemRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      if (
        itemRef.current?.matches(":hover") ||
        buttonRef.current?.matches(":focus-visible")
      ) {
        setDismissed(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <span
      className="motion-item"
      data-dismissed={dismissed ? "" : undefined}
      onPointerLeave={() => {
        setDismissed(false);
      }}
      ref={itemRef}
    >
      <button
        aria-describedby={paused ? "motion-tip-play" : "motion-tip-pause"}
        aria-label={en.motion.label}
        aria-pressed={paused}
        className="motion-toggle"
        onBlur={() => {
          setDismissed(false);
        }}
        onClick={() => {
          setMotionPaused(!paused);
        }}
        ref={buttonRef}
        type="button"
      >
        <span aria-hidden="true" className="motion-toggle-face fade-up delay-4">
          <Icon className="motion-icon-pause" name="lucide:pause" size="1rem" />
          <Icon className="motion-icon-play" name="lucide:play" size="1rem" />
        </span>
      </button>
      <span className="contact-tip motion-tip" id="motion-tip" role="tooltip">
        <span className="motion-tip-pause" id="motion-tip-pause">
          {en.motion.tipPause}
        </span>
        <span className="motion-tip-play" id="motion-tip-play">
          {en.motion.tipPlay}
        </span>
      </span>
    </span>
  );
};
