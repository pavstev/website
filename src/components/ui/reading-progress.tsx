"use client";

import { motion } from "motion/react";
import { type ReactElement, useEffect, useState } from "react";

import { readRatio } from "@/lib/blog/progress";
import { useStill } from "@/lib/use-still";

const FILL = {
  damping: 34,
  mass: 0.9,
  stiffness: 210,
  type: "spring",
} as const;
const STILL = { duration: 0 } as const;
const steps = 100;

interface ReadingProgressProps {
  className: string;
  fillClassName: string;
  label: string;
  target: string;
  valueText: string;
}

export const ReadingProgress = ({
  className,
  fillClassName,
  label,
  target,
  valueText,
}: ReadingProgressProps): ReactElement => {
  const still = useStill();
  const [step, setStep] = useState(0);

  useEffect(() => {
    let frame = 0;
    const read = (): void => {
      frame = 0;
      const box = document.querySelector(target)?.getBoundingClientRect();
      if (!box) return;
      setStep(
        Math.round(readRatio(box.top, box.height, window.innerHeight) * steps)
      );
    };
    const schedule = (): void => {
      if (frame === 0) frame = requestAnimationFrame(read);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(document.documentElement);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();
    return (): void => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [target]);

  return (
    <div
      aria-label={label}
      aria-valuemax={steps}
      aria-valuemin={0}
      aria-valuenow={step}
      aria-valuetext={valueText.replace("{percent}", () => String(step))}
      className={className}
      role="progressbar"
    >
      <motion.div
        animate={{ scaleX: step / steps }}
        className={fillClassName}
        initial={false}
        transition={still ? STILL : FILL}
      />
    </div>
  );
};
