import { type StepId } from "./step-ids.ts";

export interface RailHandle {
  dispose: () => void;
  setCurrent: (id: StepId) => void;
}

export const bindRail = (
  rail: HTMLElement,
  steps: readonly HTMLElement[],
  still: () => boolean
): RailHandle => {
  const ticks = [...rail.querySelectorAll<HTMLElement>("[data-tick]")];
  const listeners = new AbortController();
  const { signal } = listeners;
  let marked: HTMLElement | undefined;

  const jump = (id: string | undefined): void => {
    const step = steps.find((item) => item.dataset["step"] === id);
    step?.scrollIntoView({
      behavior: still() ? "auto" : "smooth",
      block: "start",
    });
  };

  for (const tick of ticks) {
    tick.addEventListener("click", () => jump(tick.dataset["tick"]), {
      signal,
    });
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
  };
};
