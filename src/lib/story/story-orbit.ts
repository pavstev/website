export interface Orbit {
  dispose: () => void;
  readonly pitch: number;
  readonly yaw: number;
}

export interface OrbitHooks {
  change: () => void;
  drag?: (active: boolean) => void;
  limits: { max: number; min: number };
}

export interface OrbitTarget {
  addEventListener: (type: string, listener: (event: Event) => void) => void;
  getBoundingClientRect: () => { height: number; width: number };
  releasePointerCapture?: (id: number) => void;
  removeEventListener: (type: string, listener: (event: Event) => void) => void;
  setPointerCapture?: (id: number) => void;
}

interface Grip {
  id: number;
  pitch: number;
  touch: boolean;
  x: number;
  y: number;
  yaw: number;
}

interface PointerFields {
  button: number;
  clientX: number;
  clientY: number;
  pointerId: number;
  pointerType: string;
}

const turnPerWidth = 2 * Math.PI;
const tipPerHeight = Math.PI;
const fullTurn = 2 * Math.PI;

const fieldsOf = (event: Event): PointerFields | undefined => {
  if (!("clientX" in event && "clientY" in event && "pointerId" in event))
    return undefined;
  const { clientX, clientY, pointerId } = event;
  if (
    typeof clientX !== "number" ||
    typeof clientY !== "number" ||
    typeof pointerId !== "number"
  )
    return undefined;
  const button =
    "button" in event && typeof event.button === "number" ? event.button : 0;
  const pointerType =
    "pointerType" in event && typeof event.pointerType === "string"
      ? event.pointerType
      : "mouse";
  return { button, clientX, clientY, pointerId, pointerType };
};

const wrap = (angle: number): number =>
  angle - fullTurn * Math.round(angle / fullTurn);

export const orbitAt = (
  start: { pitch: number; yaw: number },
  move: { dx: number; dy: number },
  size: { height: number; width: number },
  limits: { max: number; min: number }
): { pitch: number; yaw: number } => ({
  pitch: Math.min(
    limits.max,
    Math.max(
      limits.min,
      start.pitch + (move.dy / Math.max(1, size.height)) * tipPerHeight
    )
  ),
  yaw: wrap(start.yaw + (move.dx / Math.max(1, size.width)) * turnPerWidth),
});

export const createOrbit = (target: OrbitTarget, hooks: OrbitHooks): Orbit => {
  let yaw = 0;
  let pitch = 0;
  let grip: Grip | undefined;

  const onDown = (event: Event): void => {
    const point = fieldsOf(event);
    if (!point || grip || (point.pointerType === "mouse" && point.button !== 0))
      return;
    grip = {
      id: point.pointerId,
      pitch,
      touch: point.pointerType === "touch",
      x: point.clientX,
      y: point.clientY,
      yaw,
    };
    target.setPointerCapture?.(point.pointerId);
    hooks.drag?.(true);
  };

  const onMove = (event: Event): void => {
    const point = fieldsOf(event);
    if (!point || grip?.id !== point.pointerId) return;
    const next = orbitAt(
      grip,
      {
        dx: point.clientX - grip.x,
        dy: grip.touch ? 0 : point.clientY - grip.y,
      },
      target.getBoundingClientRect(),
      hooks.limits
    );
    if (next.yaw === yaw && next.pitch === pitch) return;
    ({ pitch, yaw } = next);
    hooks.change();
  };

  const onUp = (event: Event): void => {
    const point = fieldsOf(event);
    if (!point || grip?.id !== point.pointerId) return;
    target.releasePointerCapture?.(point.pointerId);
    grip = undefined;
    hooks.drag?.(false);
  };

  const onReset = (): void => {
    if (yaw === 0 && pitch === 0) return;
    yaw = 0;
    pitch = 0;
    hooks.change();
  };

  const listeners: ReadonlyArray<[string, (event: Event) => void]> = [
    ["pointerdown", onDown],
    ["pointermove", onMove],
    ["pointerup", onUp],
    ["pointercancel", onUp],
    ["dblclick", onReset],
  ];
  for (const [type, listener] of listeners)
    target.addEventListener(type, listener);

  return {
    dispose: (): void => {
      for (const [type, listener] of listeners)
        target.removeEventListener(type, listener);
      if (grip) hooks.drag?.(false);
      grip = undefined;
    },
    get pitch(): number {
      return pitch;
    },
    get yaw(): number {
      return yaw;
    },
  };
};
