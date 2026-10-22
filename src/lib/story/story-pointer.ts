import { type Box, easeToward } from "./story-scroll.ts";

export interface LoopGates {
  inView: boolean;
  still: boolean;
  visible: boolean;
}

export interface MotionInputs {
  coarse: boolean;
  paused: boolean;
  reduced: boolean;
}

export interface PointerTilt {
  dispose: () => void;
  readonly pitch: number;
  settled: () => boolean;
  tick: (dt: number) => void;
  readonly yaw: number;
}

export interface TiltHooks {
  area?: () => Box;
  wake?: () => void;
}

export interface TiltTarget {
  addEventListener: (type: string, listener: (event: Event) => void) => void;
  getBoundingClientRect?: () => Box;
  removeEventListener: (type: string, listener: (event: Event) => void) => void;
}

const tiltRate = 6;
const snapAt = 1e-4;

export const motionAllowed = ({
  coarse,
  paused,
  reduced,
}: MotionInputs): boolean => !coarse && !paused && !reduced;

export const loopMayRun = ({ inView, still, visible }: LoopGates): boolean =>
  inView && visible && !still;

const clampUnit = (value: number): number => Math.min(1, Math.max(-1, value));

const unitAt = (position: number, start: number, size: number): number =>
  size > 0 ? clampUnit(((position - start) / size) * 2 - 1) : 0;

interface Point {
  x: number;
  y: number;
}

const readPoint = (event: Event): Point | undefined => {
  if (
    !("clientX" in event) ||
    !("clientY" in event) ||
    typeof event.clientX !== "number" ||
    typeof event.clientY !== "number"
  ) {
    return undefined;
  }
  return "pointerType" in event && event.pointerType === "touch"
    ? undefined
    : { x: event.clientX, y: event.clientY };
};

const follow = (current: number, goal: number, dt: number): number => {
  const next = easeToward(current, goal, dt, tiltRate);
  return Math.abs(goal - next) < snapAt ? goal : next;
};

export const createPointerTilt = (
  target: TiltTarget,
  maxYaw: number,
  maxPitch: number,
  hooks: TiltHooks = {}
): PointerTilt => {
  let yaw = 0;
  let pitch = 0;
  let goalYaw = 0;
  let goalPitch = 0;

  const boxOf = (): Box =>
    hooks.area?.() ??
    target.getBoundingClientRect?.() ?? {
      height: 0,
      left: 0,
      top: 0,
      width: 0,
    };

  const onMove = (event: Event): void => {
    const point = readPoint(event);
    if (!point) return;
    const box = boxOf();
    goalYaw = unitAt(point.x, box.left, box.width) * maxYaw;
    goalPitch = unitAt(point.y, box.top, box.height) * maxPitch;
    hooks.wake?.();
  };

  const onLeave = (): void => {
    goalYaw = 0;
    goalPitch = 0;
    hooks.wake?.();
  };

  target.addEventListener("pointermove", onMove);
  target.addEventListener("pointerleave", onLeave);

  return {
    dispose: (): void => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerleave", onLeave);
      goalYaw = 0;
      goalPitch = 0;
      yaw = 0;
      pitch = 0;
    },
    get pitch(): number {
      return pitch;
    },
    settled: (): boolean => yaw === goalYaw && pitch === goalPitch,
    tick: (dt: number): void => {
      yaw = follow(yaw, goalYaw, dt);
      pitch = follow(pitch, goalPitch, dt);
    },
    get yaw(): number {
      return yaw;
    },
  };
};
