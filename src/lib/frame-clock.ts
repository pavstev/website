import { clamp } from "./math.ts";

export interface FrameClock {
  pause: () => void;
  tick: (now: number) => number;
}

const maxStepMs = 100;

export const createFrameClock = (startMs = 0): FrameClock => {
  let elapsed = startMs;
  let last: number | undefined;
  return {
    pause: (): void => {
      last = undefined;
    },
    tick: (now): number => {
      if (last !== undefined) {
        elapsed += clamp(now - last, 0, maxStepMs);
      }
      last = now;
      return elapsed;
    },
  };
};
