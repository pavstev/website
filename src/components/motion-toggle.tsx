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

export const MotionToggle = (): ReactElement => {
  const paused = useSyncExternalStore(
    subscribeMotionPause,
    isMotionPaused,
    () => false
  );
  const [dismissed, setDismissed] = useState(false);
  const [flash, setFlash] = useState(0);
  const itemRef = useRef<HTMLElement>(null);
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

  return (
    <header
      className="motion-item"
      data-dismissed={dismissed ? "" : undefined}
      data-flash={flash > 0 ? "" : undefined}
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
        <span aria-hidden="true" className="motion-orbit fade-up delay-4">
          <span className="motion-moon" />
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
    </header>
  );
};
