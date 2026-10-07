import { finePointerQuery, reducedMotionQuery } from "@/lib/media";

const loopMs = 7200;
const samples = 120;
const freqX = 3;
const freqY = 2;
const phaseX = Math.PI / 2;
const ampX = 64;
const ampY = 30;
const warpOne = 0.45;
const warpTwo = 0.25;
const biasX = 24;
const biasY = 8;
const riseMs = 140;
const fallMs = 220;
const tau = Math.PI * 2;

const warp = (u: number): number =>
  u +
  (warpOne / tau) * Math.sin(tau * u) +
  (warpTwo / (2 * tau)) * Math.sin(2 * tau * u);

const pose = (u: number): Keyframe => {
  const t = warp(u);
  const x = ampX * Math.sin(tau * freqX * t + phaseX);
  const y = ampY * Math.sin(tau * freqY * t);
  const turn = 360 * t;
  const scale = 1.08 + 0.06 * Math.sin(tau * 5 * t);
  return {
    offset: u,
    transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${turn.toFixed(2)}deg) scale(${scale.toFixed(3)})`,
  };
};

const keyframes = (): Keyframe[] =>
  Array.from({ length: samples + 1 }, (_, index) => pose(index / samples));

export const initPillAurora = (
  pill: HTMLElement,
  field: HTMLElement
): (() => void) => {
  const fine = globalThis.matchMedia(finePointerQuery);
  const reduce = globalThis.matchMedia(reducedMotionQuery);
  let animation: Animation | null = null;
  let hovered = false;
  let focused = false;
  let rate = 0;
  let goal = 0;
  let frame = 0;
  let last = 0;
  let rect: DOMRect | null = null;

  const ensure = (): Animation | null => {
    if (reduce.matches) return null;
    if (!animation) {
      animation = field.animate(keyframes(), {
        duration: loopMs,
        easing: "linear",
        iterations: Infinity,
      });
      animation.pause();
    }
    return animation;
  };

  const tick = (now: number): void => {
    const dt = Math.max(0, Math.min(64, now - last));
    last = now;
    const current = animation;
    if (!current) {
      frame = 0;
      return;
    }
    const span = goal > rate ? riseMs : fallMs;
    rate += (goal - rate) * (1 - Math.exp(-dt / span));
    const settled = Math.abs(goal - rate) < 0.01;
    if (settled) rate = goal;
    current.updatePlaybackRate(rate);
    if (settled && rate === 0) current.pause();
    frame = settled ? 0 : requestAnimationFrame(tick);
  };

  const sync = (): void => {
    const active = (hovered || focused) && !("busy" in pill.dataset);
    if (active) pill.dataset.aurora = "";
    else delete pill.dataset.aurora;
    const current = active ? ensure() : animation;
    if (!current) return;
    goal = active ? 1 : 0;
    if (active && current.playState !== "running") {
      rate = Math.max(rate, 0.05);
      current.updatePlaybackRate(rate);
      current.play();
    }
    if (frame) return;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  };

  const clearBias = (): void => {
    field.style.removeProperty("--bx");
    field.style.removeProperty("--by");
  };

  const onEnter = (event: PointerEvent): void => {
    if (event.pointerType !== "mouse" || !fine.matches) return;
    rect = pill.getBoundingClientRect();
    hovered = true;
    sync();
  };

  const onMove = (event: PointerEvent): void => {
    if (!rect || !hovered || reduce.matches) return;
    const nx = (event.clientX - rect.left) / rect.width - 0.5;
    const ny = (event.clientY - rect.top) / rect.height - 0.5;
    field.style.setProperty("--bx", `${(nx * 2 * biasX).toFixed(1)}px`);
    field.style.setProperty("--by", `${(ny * 2 * biasY).toFixed(1)}px`);
  };

  const onLeave = (): void => {
    hovered = false;
    rect = null;
    clearBias();
    sync();
  };

  const onFocus = (): void => {
    focused = pill.matches(":focus-visible");
    sync();
  };

  const onBlur = (): void => {
    focused = false;
    sync();
  };

  const observer = new MutationObserver(sync);
  observer.observe(pill, { attributeFilter: ["data-busy"] });
  pill.addEventListener("pointerenter", onEnter);
  pill.addEventListener("pointermove", onMove, { passive: true });
  pill.addEventListener("pointerleave", onLeave);
  pill.addEventListener("focus", onFocus);
  pill.addEventListener("blur", onBlur);

  return () => {
    observer.disconnect();
    pill.removeEventListener("pointerenter", onEnter);
    pill.removeEventListener("pointermove", onMove);
    pill.removeEventListener("pointerleave", onLeave);
    pill.removeEventListener("focus", onFocus);
    pill.removeEventListener("blur", onBlur);
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    animation?.cancel();
    animation = null;
    clearBias();
    delete pill.dataset.aurora;
  };
};
