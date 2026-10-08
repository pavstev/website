import { stillQuery } from "@/lib/motion-pause";
import { createNameTear } from "@/lib/name-tear";

const introEndMs = 5600;
const firstGapMs = 2400;
const everyMs = 8000;
const restAfterMs = 30_000;
const burstMs = 1900;
const wakeEvents = ["pointermove", "pointerdown", "keydown", "wheel", "scroll"];

const holdWords = (name: HTMLElement): void => {
  for (const word of name.querySelectorAll<HTMLElement>(".name-word")) {
    word.style.setProperty("--word-width", getComputedStyle(word).width);
  }
};

export const initNameGlitch = (name: HTMLElement): (() => void) => {
  const reduce = stillQuery();
  const tear = createNameTear(name);
  let lastInput = performance.now();
  let viewportWidth = globalThis.innerWidth;
  let tick: ReturnType<typeof setTimeout> | undefined;
  let settle: ReturnType<typeof setTimeout> | undefined;

  const wake = (): void => {
    lastInput = performance.now();
  };

  const onResize = (): void => {
    if (globalThis.innerWidth === viewportWidth) return;
    viewportWidth = globalThis.innerWidth;
    globalThis.clearTimeout(settle);
    delete name.dataset["glitch"];
  };

  const fire = (): void => {
    tick = globalThis.setTimeout(fire, everyMs);
    if (
      reduce.matches ||
      document.hidden ||
      performance.now() - lastInput > restAfterMs
    )
      return;
    name.dataset["tuned"] = "";
    holdWords(name);
    name.dataset["glitch"] = "";
    tear.play();
    globalThis.clearTimeout(settle);
    settle = globalThis.setTimeout(() => {
      delete name.dataset["glitch"];
    }, burstMs);
  };

  for (const type of wakeEvents) {
    globalThis.addEventListener(type, wake, { passive: true });
  }
  globalThis.addEventListener("resize", onResize, { passive: true });
  tick = globalThis.setTimeout(
    fire,
    Math.max(firstGapMs, introEndMs + firstGapMs - performance.now())
  );

  return () => {
    for (const type of wakeEvents) {
      globalThis.removeEventListener(type, wake);
    }
    globalThis.removeEventListener("resize", onResize);
    globalThis.clearTimeout(tick);
    globalThis.clearTimeout(settle);
    tear.dispose();
    delete name.dataset["glitch"];
  };
};
