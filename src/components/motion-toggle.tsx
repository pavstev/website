import {
  type ReactElement,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { IconMorph } from "@/components/ui/icon-morph";
import { Tooltip } from "@/components/ui/tooltip";
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
  const [flash, setFlash] = useState(0);
  const pointerRef = useRef("");

  useEffect(() => {
    if (flash === 0) return;
    const timer = setTimeout(() => {
      setFlash(0);
    }, flashMs);
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setFlash(0);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [flash]);

  const Item = variant === "corner" ? "header" : "div";
  const title = paused ? en.motion.tipPlay : en.motion.tipPause;
  const detail = paused ? en.motion.tipPlayDetail : en.motion.tipPauseDetail;

  return (
    <Item className="motion-item" data-variant={variant}>
      <Tooltip
        align="end"
        label={
          <>
            <span className="motion-tip-title">{title}</span>{" "}
            <span className="motion-tip-detail">{detail}</span>
          </>
        }
        pinned={flash > 0}
        side="bottom"
        tipClassName="motion-tip"
      >
        <button
          aria-label={paused ? en.motion.play : en.motion.pause}
          className="motion-toggle"
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
          type="button"
        >
          <span aria-hidden="true" className="motion-key fade-up delay-4">
            <span className="keycap-base" />
            <span className="motion-glyph keycap">
              <IconMorph shape={paused ? "play" : "pause"} />
            </span>
          </span>
        </button>
      </Tooltip>
    </Item>
  );
};
