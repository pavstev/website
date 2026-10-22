import { finaleStops } from "./skill-map.ts";
import { type StepId } from "./step-ids.ts";

export interface RailHandle {
  dispose: () => void;
  setCurrent: (id: StepId) => void;
  setStop: (stop: number) => void;
}

export const bindRail = (
  rail: HTMLElement,
  steps: readonly HTMLElement[],
  still: () => boolean
): RailHandle => {
  const ticks = [...rail.querySelectorAll<HTMLElement>("[data-tick]")];
  const subs = [...rail.querySelectorAll<HTMLElement>("[data-sub]")];
  const listeners = new AbortController();
  const { signal } = listeners;
  let marked: HTMLElement | undefined;
  let markedSub: HTMLElement | undefined;

  const jump = (id: string | undefined): void => {
    const step = steps.find((item) => item.dataset["step"] === id);
    const body = step?.querySelector<HTMLElement>(".story-body");
    const fits =
      body !== null &&
      body !== undefined &&
      body.offsetHeight < globalThis.innerHeight * 0.75;
    step?.scrollIntoView({
      behavior: still() ? "auto" : "smooth",
      block: fits ? "end" : "start",
    });
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
      ((stop + 0.5) / (subs.length + finaleStops)) * rect.height;
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
