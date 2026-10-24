import { finePointerQuery } from "@/lib/media";
import { isMotionPaused, stillQuery } from "@/lib/motion-pause";
import { fieldsOf, readJson } from "@/lib/record";
import { progressWriter } from "@/lib/scroll-progress";
import { bindRail } from "@/lib/scroll-rail";

import {
  buildScene,
  frameMatrix,
  orbitPitch,
  phoneLabelLimit,
  project,
  type Scene,
  type SceneCounts,
} from "./blueprint-geometry";
import { createRenderer } from "./blueprint-gl";
import { finaleStops, isSkillMap, stopAt, walkOf } from "./skill-map";
import { isStepId, type StepId } from "./step-ids";
import { fadeTo, moveTo, type Placed } from "./story-dom";
import { createOrbit } from "./story-orbit";
import { createPlates } from "./story-plates";
import {
  createPointerTilt,
  type LoopGates,
  loopMayRun,
  motionAllowed,
  type PointerTilt,
} from "./story-pointer";
import {
  type Box,
  easeToward,
  explodeAt,
  overlapsRect,
  splitProgress,
  stepAt,
  type StepOffset,
} from "./story-scroll";

interface Pin extends Placed<HTMLSpanElement> {
  height: number;
  text: string;
  tone: string;
  width: number;
}

interface Tilt {
  readonly pitch: number;
  settled(): boolean;
  tick(dt: number): void;
  readonly yaw: number;
}

const wideQuery = "(min-width: 48em)";
const pinPad = 4;
const textGap = 6;
const settleAt = 0.001;
const frameCap = 0.1;
const gridShare = 0.6;
const maxYaw = (3 * Math.PI) / 180;
const maxPitch = (2 * Math.PI) / 180;
const stillEnd = 1 - 1e-9;
const countKeys = [
  "agents",
  "guardChecks",
  "homeFiles",
  "hookEvents",
  "outputStyles",
  "presets",
  "rustPrograms",
  "skills",
] as const;

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isCounts = (value: unknown): value is SceneCounts => {
  const fields = fieldsOf(value);
  return (
    fields !== undefined && countKeys.every((key) => isNumber(fields.get(key)))
  );
};

const insideBy = (value: number, high: number): number =>
  Math.max(pinPad, Math.min(high, value));

export const mountStory = (root: HTMLElement): (() => void) => {
  const canvas = root.querySelector<HTMLCanvasElement>("canvas.story-canvas");
  const pinBox = root.querySelector<HTMLElement>(".story-labels");
  const stage = root.querySelector<HTMLElement>("[data-story-stage]");
  const list = root.querySelector<HTMLElement>(".story-steps");
  const items = [
    ...root.querySelectorAll<HTMLElement>(".story-step[data-step]"),
  ];
  const counts = readJson(root.dataset["storyCounts"], isCounts);
  const map = readJson(root.dataset["storySkills"], isSkillMap);
  const stopCounts = items.map((item) =>
    map && item.dataset["stops"] ? map.stops.length : 1
  );
  const ids = items
    .map((item) => item.dataset["step"])
    .filter((id): id is StepId => isStepId(id));
  if (
    !canvas ||
    !pinBox ||
    !stage ||
    !list ||
    !counts ||
    ids.length === 0 ||
    ids.length !== items.length
  ) {
    return () => undefined;
  }
  const renderer = createRenderer(canvas);
  if (!renderer) return () => undefined;

  const plates = createPlates(items, pinBox);
  const bar = document.querySelector<HTMLElement>("[data-blog-bar]");
  const bodies = items.map((item) =>
    item.querySelector<HTMLElement>(".story-body")
  );
  const wide = globalThis.matchMedia(wideQuery);
  const pins = new Map<string, Pin>();
  const fine = globalThis.matchMedia(finePointerQuery);
  const still = stillQuery();
  const rail = root.querySelector<HTMLElement>("[data-scroll-rail]");
  const railHandle = rail
    ? bindRail(rail, items, () => still.matches, {
        bodySelector: ".story-body",
        finaleStops,
      })
    : undefined;
  const writeProgress = progressWriter(root);
  let pointer: PointerTilt | undefined;
  const tilt: Tilt = {
    get pitch(): number {
      return pointer?.pitch ?? 0;
    },
    settled: (): boolean => pointer?.settled() ?? true,
    tick: (dt: number): void => pointer?.tick(dt),
    get yaw(): number {
      return pointer?.yaw ?? 0;
    },
  };
  let offsets: StepOffset[] = [];
  let canvasWidth = 1;
  let canvasHeight = 1;
  let pinWidth = 1;
  let pinHeight = 1;
  let shiftX = 0;
  let shiftY = 0;
  let barHeight = 0;
  let goal = 0;
  let shown = 0;
  let current = -1;
  let currentStop = -1;
  let inView = true;
  let handle = 0;
  let last = 0;
  let disposed = false;
  let stillHandle = 0;

  const gates = (): LoopGates => ({
    inView,
    still: still.matches,
    visible: document.visibilityState === "visible",
  });

  const viewable = (): boolean => {
    const { inView: seen, visible } = gates();
    return !disposed && seen && visible;
  };

  const mayRun = (): boolean => !disposed && loopMayRun(gates());

  const onStepChange = (index: number): void => {
    const id = ids[index];
    root.dataset["storyStep"] = id ?? "";
    if (id) railHandle?.setCurrent(id);
  };

  const measure = (): void => {
    const scrolled = window.scrollY;
    offsets = items.map((item) => {
      const rect = item.getBoundingClientRect();
      return { height: rect.height, top: rect.top + scrolled };
    });
    canvasWidth = Math.max(1, canvas.clientWidth);
    canvasHeight = Math.max(1, canvas.clientHeight);
    pinWidth = pinBox.clientWidth;
    pinHeight = pinBox.clientHeight;
    shiftX = canvas.offsetLeft - pinBox.offsetLeft;
    shiftY = canvas.offsetTop - pinBox.offsetTop;
    barHeight = bar?.offsetHeight ?? 0;
    for (const [i, item] of items.entries()) {
      const body = bodies[i];
      if (!body || !item.dataset["stops"]) continue;
      const inset = Number(
        getComputedStyle(body).insetBlockEnd.replace("px", "")
      );
      const room = pinHeight - barHeight - (Number.isFinite(inset) ? inset : 0);
      item.toggleAttribute("data-story-loose", body.offsetHeight > room);
    }
  };

  const stopOf = (index: number, t: number): number => {
    const count = stopCounts[index] ?? 1;
    return count > 1 ? stopAt(walkOf(t, count), count).stop : -1;
  };

  const stillGoal = (index: number, t: number): number => {
    const count = stopCounts[index] ?? 1;
    return count > 1 && walkOf(t, count) < 1
      ? (stopOf(index, t) + 1) / (count + finaleStops) - 1e-6
      : stillEnd;
  };

  const retarget = (): void => {
    const at = stepAt(window.scrollY, offsets);
    goal = at.index + (still.matches ? stillGoal(at.index, at.t) : at.t);
    const stop = stopOf(at.index, at.t);
    if (stop !== currentStop) {
      currentStop = stop;
      railHandle?.setStop(stop);
    }
    if (at.index === current) {
      return;
    }

    current = at.index;
    onStepChange(at.index);
  };

  const syncTilt = (): void => {
    const allowed = motionAllowed({
      coarse: !fine.matches,
      paused: isMotionPaused(),
      reduced: still.matches,
    });
    if (allowed && !pointer) {
      pointer = createPointerTilt(root, maxYaw, maxPitch, {
        area: () => stage.getBoundingClientRect(),
        wake: schedule,
      });
    } else if (!allowed && pointer) {
      pointer.dispose();
      pointer = undefined;
    }
  };

  const makePin = (): Pin => {
    const el = document.createElement("span");
    pinBox.append(el);
    return { alpha: -1, at: "", el, height: 0, text: "", tone: "", width: 0 };
  };

  const placePins = (
    scene: Scene,
    view: Float32Array,
    avoid: readonly Box[]
  ): void => {
    const seen = new Set<string>();
    const stale: Pin[] = [];
    const placed = scene.labels.map((label) => {
      seen.add(label.id);
      const pin = pins.get(label.id) ?? makePin();
      pins.set(label.id, pin);
      if (pin.text !== label.text || pin.tone !== label.tone) {
        pin.text = label.text;
        pin.tone = label.tone;
        pin.el.textContent = label.text;
        pin.el.className = `story-pin tone-${label.tone}`;
        stale.push(pin);
      }
      return { label, pin };
    });
    for (const pin of stale) {
      pin.width = pin.el.offsetWidth;
      pin.height = pin.el.offsetHeight;
    }
    for (const { label, pin } of placed) {
      const [x, y] = project(view, label.at, canvasWidth, canvasHeight);
      const left = insideBy(
        x + shiftX - (label.center ? pin.width / 2 : 0),
        pinWidth - pin.width - pinPad
      );
      const top = insideBy(
        y + shiftY - pin.height / 2,
        pinHeight - pin.height - pinPad
      );
      moveTo(pin, left, top);
      const spot = {
        height: pin.height,
        left: left - shiftX,
        top: top - shiftY,
        width: pin.width,
      };
      fadeTo(
        pin,
        avoid.some((box) => overlapsRect(spot, box, textGap)) ? 0 : label.alpha
      );
    }
    for (const [id, pin] of pins) if (!seen.has(id)) fadeTo(pin, 0);
  };

  const dimBox = (index: number, area: DOMRect): Box | undefined => {
    const body = bodies[index];
    if (!body) return undefined;
    const rect = body.getBoundingClientRect();
    return {
      height: rect.height,
      left: rect.left - area.left,
      top: rect.top - area.top,
      width: rect.width,
    };
  };

  const textBoxes = (index: number): Box[] => {
    const area = canvas.getBoundingClientRect();
    return [index, index - 1, index + 1]
      .map((near) => dimBox(near, area))
      .filter(
        (box, i): box is Box =>
          box !== undefined &&
          (i === 0 || (box.top < canvasHeight && box.top + box.height > 0))
      );
  };

  const paint = (dt: number): boolean => {
    shown = easeToward(shown, goal, dt);
    if (Math.abs(goal - shown) < settleAt) shown = goal;
    tilt.tick(dt);
    const { index, t } = splitProgress(shown, ids.length);
    const texts = textBoxes(index);
    const scene = buildScene(
      ids[index] ?? "hero",
      t,
      explodeAt(t),
      counts,
      wide.matches ? undefined : phoneLabelLimit,
      map
    );
    const aspect = canvasWidth / canvasHeight;
    const view = frameMatrix(
      aspect,
      scene,
      tilt.yaw + orbit.yaw,
      tilt.pitch + orbit.pitch
    );
    const grid = frameMatrix(
      aspect,
      scene,
      tilt.yaw * gridShare + orbit.yaw,
      tilt.pitch * gridShare + orbit.pitch
    );
    renderer.draw(scene, view, grid, texts);
    placePins(scene, view, texts);
    const anchor = scene.plate
      ? project(view, scene.plate, canvasWidth, canvasHeight)
      : undefined;
    plates.place(
      index,
      anchor && [anchor[0] + shiftX, anchor[1] + shiftY],
      texts,
      { height: pinHeight, top: barHeight, width: pinWidth },
      wide.matches,
      Math.max(0, stopOf(index, t))
    );
    if (!wide.matches) writeProgress(shown / ids.length);
    return goal === shown && tilt.settled();
  };

  const showStill = (): void => {
    shown = goal;
    paint(0);
  };

  const invalidatePins = (): void => {
    for (const pin of pins.values()) pin.text = "";
    plates.invalidate();
  };

  const frame = (now: number): void => {
    handle = 0;
    const dt = last === 0 ? 1 / 60 : Math.min((now - last) / 1000, frameCap);
    last = now;
    if (paint(dt)) {
      last = 0;
      return;
    }
    schedule();
  };

  const schedule = (): void => {
    if (handle !== 0 || !mayRun()) return;
    handle = globalThis.requestAnimationFrame(frame);
  };

  const sleep = (): void => {
    globalThis.cancelAnimationFrame(handle);
    handle = 0;
    last = 0;
  };

  const redraw = (): void => {
    if (!viewable()) return;
    if (!still.matches) {
      schedule();
      return;
    }
    if (stillHandle !== 0) return;
    stillHandle = globalThis.requestAnimationFrame(() => {
      stillHandle = 0;
      if (viewable()) paint(0);
    });
  };

  const orbit = createOrbit(stage, {
    change: redraw,
    drag: (active) => {
      if (active) root.dataset["storyDrag"] = "";
      else delete root.dataset["storyDrag"];
    },
    limits: orbitPitch,
  });

  const onScroll = (): void => {
    const before = current;
    const stopBefore = currentStop;
    retarget();
    if (!still.matches) {
      schedule();
      return;
    }

    if ((current !== before || currentStop !== stopBefore) && viewable())
      showStill();
  };

  const onResize = (): void => {
    measure();
    renderer.resize();
    invalidatePins();
    retarget();
    if (!viewable()) return;
    if (still.matches) {
      showStill();
      return;
    }
    paint(0);
    schedule();
  };

  const onVisible = (): void => {
    retarget();
    if (!viewable()) {
      sleep();
      return;
    }
    if (still.matches) {
      sleep();
      showStill();
      return;
    }
    schedule();
  };

  const onMotion = (): void => {
    syncTilt();
    onVisible();
  };

  const onFonts = (): void => {
    if (disposed) return;
    invalidatePins();
    if (!viewable()) return;
    paint(0);
    schedule();
  };

  const watchView = new IntersectionObserver((entries) => {
    inView = entries.at(-1)?.isIntersecting ?? false;
    onVisible();
  });
  const watchSize = new ResizeObserver(onResize);
  const listeners = new AbortController();

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    sleep();
    globalThis.cancelAnimationFrame(stillHandle);
    stillHandle = 0;
    orbit.dispose();
    delete root.dataset["storyDrag"];
    listeners.abort();
    still.removeEventListener("change", onMotion);
    pointer?.dispose();
    pointer = undefined;
    railHandle?.dispose();
    watchView.disconnect();
    watchSize.disconnect();
    renderer.dispose();
    pins.clear();
    plates.dispose();
    pinBox.replaceChildren();
    delete root.dataset["storyState"];
  };

  measure();
  retarget();
  shown = goal;
  paint(0);
  root.dataset["storyState"] = "live";

  const { signal } = listeners;
  window.addEventListener("scroll", onScroll, { passive: true, signal });
  document.addEventListener("visibilitychange", onVisible, { signal });
  wide.addEventListener("change", onResize, { signal });
  still.addEventListener("change", onMotion);
  fine.addEventListener("change", onMotion, { signal });
  syncTilt();
  void document.fonts.ready.then(onFonts);
  canvas.addEventListener(
    "webglcontextlost",
    (event) => {
      event.preventDefault();
      dispose();
    },
    { signal }
  );
  watchView.observe(stage);
  watchSize.observe(canvas);
  watchSize.observe(pinBox);
  watchSize.observe(list);
  return dispose;
};
