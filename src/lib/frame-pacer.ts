const idleAfterMs = 800;
const idleFrameMs = 30;
const stallMs = 100;
const stallLimit = 8;
const slowFrameMs = 26;
const frozenFrameMs = 40;
const downgradeAfter = 60;
const freezeAfter = 120;
const firstFrameMs = 1000 / 60;

interface FramePacer {
  markActive: (holdMs?: number) => void;
  reset: () => void;
  step: (now: number) => PacerStep;
}

interface PacerOptions {
  activeFrameMs: number;
  canDowngrade: () => boolean;
  downgrade: () => void;
}

type PacerStep = { dt: number; kind: "draw" } | { kind: "freeze" | "skip" };

export const pacerIdleMs = idleAfterMs;

export const createFramePacer = ({
  activeFrameMs,
  canDowngrade,
  downgrade,
}: PacerOptions): FramePacer => {
  let last = 0;
  let lastActive = 0;
  let frameAvg = activeFrameMs;
  let slowFrames = 0;
  let stalls = 0;

  const trackSpeed = (gap: number): boolean => {
    frameAvg += (gap - frameAvg) * 0.05;
    if (frameAvg > slowFrameMs && canDowngrade()) {
      slowFrames += 1;
      if (slowFrames > downgradeAfter) {
        slowFrames = 0;
        frameAvg = activeFrameMs;
        downgrade();
      }
      return false;
    }
    if (frameAvg > frozenFrameMs) {
      slowFrames += 1;
      return slowFrames > freezeAfter;
    }
    slowFrames = 0;
    return false;
  };

  return {
    markActive: (holdMs = 0) => {
      lastActive = Math.max(lastActive, performance.now() + holdMs);
    },
    reset: () => {
      last = 0;
    },
    step: (now) => {
      const gap = now - last;
      const idle = now - lastActive > idleAfterMs;
      if (last > 0 && gap < (idle ? idleFrameMs : activeFrameMs)) {
        return { kind: "skip" };
      }
      stalls = last > 0 && gap >= stallMs ? stalls + 1 : 0;
      if (stalls >= stallLimit) return { kind: "freeze" };
      if (!idle && last > 0 && gap < stallMs && trackSpeed(gap)) {
        return { kind: "freeze" };
      }
      const dt = last > 0 ? Math.min(gap, stallMs) : firstFrameMs;
      last = now;
      return { dt, kind: "draw" };
    },
  };
};
