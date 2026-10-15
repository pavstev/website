import {
  type MotionValue,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect } from "react";

import { useStill } from "@/lib/use-still";

const SMOOTH = { damping: 44, mass: 0.6, stiffness: 240 } as const;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export interface CondenseRange {
  from: number;
  to: number;
}

export const useCondense = (
  measure: () => CondenseRange | undefined
): MotionValue<number> => {
  const still = useStill();
  const { scrollY } = useScroll();
  const tracked = useMotionValue(0);
  const sprung = useSpring(tracked, SMOOTH);
  const stepped = useTransform(tracked, (value): number =>
    value >= 0.5 ? 1 : 0
  );

  useEffect(() => {
    let range = measure();
    const read = (): void => {
      if (range === undefined) {
        tracked.set(0);
        return;
      }
      const ratio = (scrollY.get() - range.from) / (range.to - range.from);
      tracked.set(clamp01(ratio));
    };
    read();
    sprung.jump(tracked.get());
    const stop = scrollY.on("change", read);
    const observer = new ResizeObserver(() => {
      range = measure();
      read();
    });
    observer.observe(document.documentElement);
    return (): void => {
      stop();
      observer.disconnect();
    };
  }, [measure, scrollY, sprung, tracked]);

  return still ? stepped : sprung;
};
