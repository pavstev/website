export interface TooltipStore {
  close: (id: string, immediate: boolean) => void;
  dismiss: (id: string) => void;
  dispose: () => void;
  getActive: () => null | string;
  getSkipped: () => boolean;
  getTravel: () => number;
  getWarm: () => boolean;
  open: (id: string, immediate: boolean, x?: number) => void;
  reset: () => void;
  seat: string;
  subscribe: (listener: () => void) => () => void;
  unblock: (id: string) => void;
}

export interface TooltipTiming {
  closeDelay: number;
  openDelay: number;
  skipDelay: number;
}

type Timer = null | ReturnType<typeof setTimeout>;

let groups = 0;

const stop = (timer: Timer): null => {
  if (timer !== null) clearTimeout(timer);
  return null;
};

export const createTooltipStore = (
  getTiming: () => TooltipTiming
): TooltipStore => {
  const listeners = new Set<() => void>();
  let active: null | string = null;
  let pending: null | string = null;
  let blocked: null | string = null;
  let warm = false;
  let skipped = false;
  let lastX: null | number = null;
  let travel = 0;
  let openTimer: Timer = null;
  let closeTimer: Timer = null;
  let coolTimer: Timer = null;

  const notify = (): void => {
    for (const listener of listeners) listener();
  };

  const setActive = (next: null | string): void => {
    if (active === next) return;
    if (next !== null) {
      skipped = warm;
      warm = true;
    }
    active = next;
    notify();
  };

  const cool = (): void => {
    coolTimer = stop(coolTimer);
    const { skipDelay } = getTiming();
    if (skipDelay <= 0) {
      if (warm) {
        warm = false;
        notify();
      }
      return;
    }
    coolTimer = setTimeout(() => {
      coolTimer = null;
      warm = false;
      notify();
    }, skipDelay);
  };

  const clearTimers = (): void => {
    openTimer = stop(openTimer);
    closeTimer = stop(closeTimer);
    coolTimer = stop(coolTimer);
  };

  groups += 1;

  return {
    close: (id, immediate) => {
      if (pending === id) {
        openTimer = stop(openTimer);
        pending = null;
      }
      if (active !== id) return;
      closeTimer = stop(closeTimer);
      const finish = (): void => {
        closeTimer = null;
        setActive(null);
        cool();
      };
      if (immediate || getTiming().closeDelay <= 0) {
        finish();
        return;
      }
      closeTimer = setTimeout(finish, getTiming().closeDelay);
    },
    dismiss: (id) => {
      blocked = id;
      clearTimers();
      pending = null;
      const wasWarm = warm;
      warm = false;
      if (active === id) setActive(null);
      else if (wasWarm) notify();
    },
    dispose: () => {
      clearTimers();
      listeners.clear();
    },
    getActive: () => active,
    getSkipped: () => skipped,
    getTravel: () => travel,
    getWarm: () => warm,
    open: (id, immediate, x) => {
      if (blocked === id) return;
      closeTimer = stop(closeTimer);
      coolTimer = stop(coolTimer);
      if (active === id) {
        openTimer = stop(openTimer);
        pending = null;
        return;
      }
      const arrive = (): void => {
        travel = lastX !== null && x !== undefined ? Math.sign(x - lastX) : 0;
        lastX = x ?? null;
        setActive(id);
      };
      openTimer = stop(openTimer);
      if (immediate || warm) {
        pending = null;
        arrive();
        return;
      }
      pending = id;
      openTimer = setTimeout(() => {
        openTimer = null;
        pending = null;
        arrive();
      }, getTiming().openDelay);
    },
    reset: () => {
      clearTimers();
      pending = null;
      blocked = null;
      lastX = null;
      travel = 0;
      const wasWarm = warm;
      warm = false;
      if (active !== null) setActive(null);
      else if (wasWarm) notify();
    },
    seat: `tooltip-seat-${String(groups)}`,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    unblock: (id) => {
      if (blocked === id) blocked = null;
    },
  };
};
