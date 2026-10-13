"use client";

import {
  type ReactElement,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { en } from "@/lib/i18n";
import {
  isMotionPaused,
  setMotionPaused,
  subscribeMotionPause,
} from "@/lib/motion-pause";

const flashMs = 2000;

interface MotionToggleProps {
  variant?: "bar" | "corner";
}

export const MotionToggle = ({
  variant = "corner",
}: MotionToggleProps): ReactElement => {
  const paused = useSyncExternalStore(
    subscribeMotionPause,
    isMotionPaused,
    () => false
  );
  const [dismissed, setDismissed] = useState(false);
  const [flash, setFlash] = useState(0);
  const itemRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pointerRef = useRef("");

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

  useEffect(() => {
    if (flash === 0) return;
    const timer = setTimeout(() => {
      setFlash(0);
    }, flashMs);
    return () => {
      clearTimeout(timer);
    };
  }, [flash]);

  const Item = variant === "corner" ? "header" : "div";

  return (
    <Item
      className="motion-item"
      data-dismissed={dismissed ? "" : undefined}
      data-flash={flash > 0 ? "" : undefined}
      data-variant={variant}
      onPointerLeave={() => {
        setDismissed(false);
      }}
      ref={itemRef}
    >
      <button
        aria-describedby={paused ? "motion-tip-play" : "motion-tip-pause"}
        aria-label={paused ? en.motion.play : en.motion.pause}
        className="motion-toggle"
        onBlur={() => {
          setDismissed(false);
        }}
        onClick={() => {
          setMotionPaused(!paused);
          if (pointerRef.current === "touch") {
            setFlash((count) => count + 1);
          }
          pointerRef.current = "";
        }}
        onPointerDown={(event) => {
          pointerRef.current = event.pointerType;
        }}
        ref={buttonRef}
        type="button"
      >
        <span aria-hidden="true" className="motion-glyph fade-up delay-4">
          <span className="motion-bar" data-side="start" />
          <span className="motion-bar" data-side="end" />
        </span>
      </button>
      <span className="contact-tip motion-tip" role="tooltip">
        <span className="motion-tip-pause" id="motion-tip-pause">
          <span className="motion-tip-title">{en.motion.tipPause}</span>{" "}
          <span className="motion-tip-detail">{en.motion.tipPauseDetail}</span>
        </span>
        <span className="motion-tip-play" id="motion-tip-play">
          <span className="motion-tip-title">{en.motion.tipPlay}</span>{" "}
          <span className="motion-tip-detail">{en.motion.tipPlayDetail}</span>
        </span>
      </span>
    </Item>
  );
};
