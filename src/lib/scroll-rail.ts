export interface RailHandle {
  dispose: () => void;
  setCurrent: (id: string) => void;
  setStop: (stop: number) => void;
}

export interface RailOptions {
  bodySelector: string;
  finaleStops?: number;
  notBeforeTop?: boolean;
}

export interface RailSubs {
  names: readonly string[];
  step: string;
}

export interface RailTick {
  id: string;
  name: string;
}

const px = (value: string): number => Number(value.replace(/px$/u, "")) || 0;

const endLanding = (step: HTMLElement): number => {
  const rect = step.getBoundingClientRect();
  const top = rect.top + globalThis.scrollY;
  const end =
    top +
    rect.height -
    globalThis.innerHeight +
    px(getComputedStyle(document.documentElement).scrollPaddingBlockEnd) +
    px(getComputedStyle(step).scrollMarginBlockEnd);
  return Math.max(top, end);
};

export const bindRail = (
  rail: HTMLElement,
  steps: readonly HTMLElement[],
  still: () => boolean,
  options: RailOptions
): RailHandle => {
  const ticks = [...rail.querySelectorAll<HTMLElement>("[data-tick]")];
  const subs = [...rail.querySelectorAll<HTMLElement>("[data-sub]")];
  const listeners = new AbortController();
  const { signal } = listeners;
  const finale = options.finaleStops ?? 0;
  let marked: HTMLElement | undefined;
  let markedSub: HTMLElement | undefined;

  const jump = (id: string | undefined): void => {
    const step = steps.find((item) => item.dataset["step"] === id);
    const body = step?.querySelector<HTMLElement>(options.bodySelector);
    const fits =
      body !== null &&
      body !== undefined &&
      body.offsetHeight < globalThis.innerHeight * 0.75;
    const behavior = still() ? "auto" : "smooth";
    if (step && fits && options.notBeforeTop === true) {
      globalThis.scrollTo({ behavior, top: endLanding(step) });
      return;
    }
    step?.scrollIntoView({ behavior, block: fits ? "end" : "start" });
  };

  const jumpStop = (sub: HTMLElement): void => {
    const step = steps.find(
      (item) => item.dataset["step"] === sub.dataset["subStep"]
    );
    if (!step) return;
    const rect = step.getBoundingClientRect();
    const stop = Number(sub.dataset["sub"] ?? "0");
    const top =
      rect.top +
      globalThis.scrollY +
      ((stop + 0.5) / (subs.length + finale)) * rect.height;
    globalThis.scrollTo({ behavior: still() ? "auto" : "smooth", top });
  };

  for (const tick of ticks) {
    tick.addEventListener("click", () => jump(tick.dataset["tick"]), {
      signal,
    });
  }
  for (const sub of subs) {
    sub.addEventListener("click", () => jumpStop(sub), { signal });
  }

  return {
    dispose: (): void => {
      listeners.abort();
    },
    setCurrent: (id): void => {
      const next = ticks.find((tick) => tick.dataset["tick"] === id);
      if (next === marked) return;
      marked?.removeAttribute("aria-current");
      next?.setAttribute("aria-current", "step");
      marked = next;
    },
    setStop: (stop): void => {
      const next = subs[stop];
      if (next === markedSub) return;
      markedSub?.removeAttribute("aria-current");
      next?.setAttribute("aria-current", "step");
      markedSub = next;
    },
  };
};
