import { type ReactElement, useEffect, useRef } from "react";

import { isCrawler } from "@/lib/crawler";
import { createFrameClock } from "@/lib/frame-clock";
import { createFramePacer } from "@/lib/frame-pacer";
import { finePointerQuery, reducedMotionQuery } from "@/lib/media";
import { prefersLightLoad } from "@/lib/save-data";
import {
  isSceneHeld,
  motionPausedAttribute,
  sceneHoldEvent,
} from "@/lib/scene-hold";
import {
  type InkTarget,
  inkTargets,
  liftFor,
  nextLift,
  postInkTargets,
  skyLevel,
} from "@/lib/sky-ink";
import { blogLook, type SkyMode } from "@/lib/sky-preset";
import { createSkyProbe, type ProbeBox, type SkyProbe } from "@/lib/sky-probe";
import { cornerCorona, cornerMeteor, longRaysShader } from "@/lib/sky-rays";
import { skyVertexShader } from "@/lib/sky-shader";
import {
  crawlerInstant,
  instantOverride,
  type Spot,
  sunSpot,
} from "@/lib/sky-sun";
import {
  arriveDelay,
  arriveMs,
  easeInOut,
  heldProgress,
  holdAt,
  leaveMs,
  linkMode,
  routeMode,
  tweenMs,
  tweenPose,
  tweenProgress,
} from "@/lib/sky-tween";
import { type ViewSize } from "@/lib/sky-view";
import { createUniformSink } from "@/lib/uniform-sink";
import { isSoftwareRenderer } from "@/lib/webgl";

interface InkNodes {
  paint: HTMLElement | null;
  probe: Element | null;
}

interface Puff {
  age: number;
  at: number;
  x: number;
  y: number;
}

interface QualityLevel {
  clouds: boolean;
  scale: number;
}

type SpaceState = "fallback" | "paused" | "running" | "static";

interface Tween {
  clickAt: number;
  fade: number;
  forward: boolean;
  shift: number;
  startAt: number | undefined;
  sun: Spot | undefined;
  swapped: boolean;
}

const softwareLevel: QualityLevel = { clouds: false, scale: 0.2 };

const LEVELS: QualityLevel[] = [
  { clouds: true, scale: 0.75 },
  { clouds: true, scale: 0.5 },
  { clouds: false, scale: 0.35 },
];

const frameDt = 1000 / 60;
const activeFrameMs = 10.8;
const followRate = 3.7;
const parallaxReach = 0.01175;
const labPixelsPerCss = 1.2;
const maxCanvasPixels = 1_400_000;
const resizeDelayMs = 150;
const meteorMs = 1600;
const meteorGapMs = 4400;
const meteorRoom = 0.55;
const rayViewShare = 0.72;
const rayViewMaxCss = 960;
const driftShare = 0.4;
const fadeHeadShare = 0.3;
const fadeHeadPx: [number, number] = [224, 352];
const timeWrapHighSeconds = 86_400;
const timeWrapLowSeconds = 1024;
const probeEveryMs = 1000;
const scrollQuietMs = 180;
const probeReadMs = 34;
const probeSlackMs = 5;
const cloudZone = 0.8;
const gustMax = 3.5;
const gustEaseSeconds = 2.3;
const gustGain = 1.8;
const gustActive = 0.01;
const touchScrollShare = 0.25;
const puffSlots = 10;
const puffSpacing = 0.11;
const puffZone = 0.55;
const puffTop = 0.3;
const puffRiseSeconds = 0.7;
const puffAmount = 0.9;
const puffSettleSeconds = 4;
const puffVisible = 0.003;
const sunEveryMs = 30_000;
const modeTargets: Readonly<Record<SkyMode, readonly InkTarget[]>> = {
  blog: postInkTargets,
  home: inkTargets,
};

const puffStrength = (puff: Puff): number => {
  const rise = Math.min(1, puff.age / puffRiseSeconds);
  return (
    puffAmount *
    rise *
    rise *
    (3 - 2 * rise) *
    Math.exp(-Math.max(0, puff.age - puffRiseSeconds) / (puffSettleSeconds / 3))
  );
};

const createShader = (
  gl: WebGLRenderingContext,
  type: number,
  source: string
): undefined | WebGLShader => {
  const shader = gl.createShader(type);
  if (!shader) return undefined;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
};

const whenLinked = (
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  onDone: (linked: boolean) => void
): (() => void) => {
  const parallel = gl.getExtension("KHR_parallel_shader_compile");
  let handle = 0;
  const poll = (): void => {
    const pending =
      parallel !== null &&
      gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR) !== true;
    if (pending) {
      handle = globalThis.requestAnimationFrame(poll);
      return;
    }
    onDone(gl.getProgramParameter(program, gl.LINK_STATUS) === true);
  };
  poll();
  return () => globalThis.cancelAnimationFrame(handle);
};

const bindTriangle = (
  gl: WebGLRenderingContext,
  program: WebGLProgram
): null | WebGLBuffer => {
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW
  );
  const position = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  return buffer;
};

const releaseProgram = (
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  shaders: WebGLShader[]
): void => {
  gl.deleteProgram(program);
  for (const shader of shaders) gl.deleteShader(shader);
};

const releaseWhenDetached = (
  gl: WebGLRenderingContext,
  canvas: HTMLCanvasElement
): void => {
  globalThis.setTimeout(() => {
    if (canvas.isConnected || gl.isContextLost()) return;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }, 0);
};

const contextOptions: WebGLContextAttributes = {
  alpha: false,
  antialias: false,
  depth: false,
  powerPreference: "low-power",
  stencil: false,
};

const startSky = (
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  canvas: HTMLCanvasElement,
  reduceMotion: MediaQueryList,
  still: boolean,
  setState: (state: SpaceState) => void
): (() => void) => {
  let mode = routeMode(globalThis.location.pathname);
  const root = document.documentElement;
  const drift = canvas.parentElement;
  const { search } = globalThis.location;
  const held = heldProgress(search);
  const triangle = bindTriangle(gl, program);
  const position = gl.getAttribLocation(program, "a_pos");
  const uniforms = createUniformSink(gl, program);
  const highPrecision =
    (gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)
      ?.precision ?? 0) > 0;
  const timeWrap = highPrecision ? timeWrapHighSeconds : timeWrapLowSeconds;

  let level = 0;
  const currentLevel = (): QualityLevel | undefined =>
    still ? softwareLevel : (LEVELS[level] ?? LEVELS[0]);
  let scale = 1;
  let rafId = 0;
  let frozen = false;
  let targets = modeTargets[mode];
  let probe: SkyProbe | undefined;
  let inkNodes: InkNodes[] = [];
  let lifts: number[] = [];
  let inkSeen: boolean[] = [];
  const textRange = document.createRange();
  let probedAt = performance.now();
  let scrolledAt = -Infinity;
  let probeTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let readTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let arriveTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let probing = false;
  const pointer = { x: 0, y: 0 };
  const pointerTarget = { x: 0, y: 0 };
  const meteor = { angle: 0, at: 0, x: 0, y: 0 };
  const gust = { dir: -1, energy: 0, inside: false, x: 0, y: 0 };
  let cloudMs = 0;
  let shiftMs = 0;
  const pinned = instantOverride(search);
  const crawler = pinned === undefined && isCrawler(navigator.userAgent);
  const look = blogLook();
  const calm = crawler || prefersLightLoad();
  if (calm && drift) drift.dataset["skyStill"] = "";
  const instant = (): number =>
    crawler ? crawlerInstant : (pinned ?? Date.now());
  let sun: Spot | undefined;
  let sunAt = -Infinity;
  let tween: Tween | undefined;
  let holding = false;
  let driftFrame = 0;
  const scriptDrift =
    drift !== null && !CSS.supports("animation-timeline", "scroll()");
  const puffs: Puff[] = [];
  const puffData = new Float32Array(puffSlots * 4);
  let lastPuff: [number, number] | undefined;
  const clock = createFrameClock();
  const hoverPointer = globalThis.matchMedia(finePointerQuery);
  let resizeTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  const cardRange = document.createRange();

  const rayView = (): number =>
    Math.round(
      Math.min(window.innerHeight * rayViewShare, rayViewMaxCss) * scale
    );
  const viewPixels = (): number =>
    Math.max(1, Math.min(canvas.height, rayView()));

  const toSky = (clientX: number, clientY: number): [number, number] => {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * scale;
    const y = (rect.bottom - clientY) * scale;
    const view = viewPixels();
    return [(x - canvas.width / 2) / view, (y - canvas.height / 2) / view];
  };

  const launch = (now: number): void => {
    const view = viewPixels();
    const halfWidth = canvas.width / view / 2;
    Object.assign(meteor, cornerMeteor, {
      at: now + meteorGapMs,
      x: Math.min(cornerMeteor.x, halfWidth - meteorRoom),
      y: canvas.height / view / 2 - (0.5 - cornerMeteor.y),
    });
  };

  const pacer = createFramePacer({
    activeFrameMs,
    canDowngrade: () => level < LEVELS.length - 1,
    downgrade: () => {
      level += 1;
      resize();
    },
  });
  const { markActive } = pacer;

  const resize = (): void => {
    const entry = currentLevel();
    if (!entry) return;
    const cssWidth = Math.max(1, canvas.clientWidth);
    const cssHeight = Math.max(1, canvas.clientHeight);
    const cap = Math.sqrt(maxCanvasPixels / (cssWidth * cssHeight));
    scale = Math.min(entry.scale, cap) * Math.min(window.devicePixelRatio, 1);
    const width = Math.max(1, Math.floor(cssWidth * scale));
    const height = Math.max(1, Math.floor(cssHeight * scale));
    if (width === canvas.width && height === canvas.height) return;
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
  };

  const screenView = (): ViewSize => {
    const view: ViewSize = {
      height: window.innerHeight,
      width: window.innerWidth,
    };
    const card = document.querySelector("[data-card]")?.getBoundingClientRect();
    if (!card || card.width <= 0) return view;
    let { left, right } = card;
    const bio = document.querySelector("[data-card] .bio");
    if (bio) {
      cardRange.selectNodeContents(bio);
      const text = cardRange.getBoundingClientRect();
      if (text.width > 0) ({ left, right } = text);
    }
    view.card = { bottom: card.bottom, left, right, top: card.top };
    return view;
  };

  const refreshSun = (): void => {
    sun = sunSpot(instant(), screenView());
    sunAt = performance.now();
  };

  const corner = (): Spot => {
    const radius = cornerCorona(viewPixels()).radius / scale;
    const { top } = canvas.getBoundingClientRect();
    return { radius, x: -radius, y: top - radius };
  };

  const setSource = (source: Spot | undefined, disk: number): void => {
    uniforms.set("u_disk", disk);
    if (!source) {
      uniforms.set("u_portrait", 0, 0, 0);
      return;
    }
    const box = canvas.getBoundingClientRect();
    uniforms.set(
      "u_portrait",
      (source.x - box.left) * scale,
      canvas.height - (source.y - box.top) * scale,
      source.radius * scale
    );
  };

  const liveDrift = (): [number, number] => {
    if (!drift) return [0, 0];
    delete drift.dataset["skyTween"];
    const [, y = "0"] = getComputedStyle(drift).translate.split(" ", 2);
    const fadeNode = drift.querySelector("[data-sky-fade]");
    const fade = fadeNode ? Number(getComputedStyle(fadeNode).opacity) : 0;
    drift.dataset["skyTween"] = "";
    const shift = Number(y.replace("px", ""));
    return [
      Number.isFinite(shift) ? shift : 0,
      Number.isFinite(fade) ? fade : 0,
    ];
  };

  const pinDrift = (active: Tween, share: number): void => {
    if (!drift) return;
    const [shift, fade] = liveDrift();
    drift.style.setProperty(
      "--sky-shift",
      `${(active.shift + (shift - active.shift) * share).toFixed(1)}px`
    );
    drift.style.setProperty(
      "--sky-fade-now",
      (active.fade + (fade - active.fade) * share).toFixed(3)
    );
  };

  const wrapperTop = (): number => canvas.getBoundingClientRect().top;

  const placeSource = (now: number): void => {
    if (tween) {
      tween.startAt ??= now;
      const elapsed = now - tween.startAt;
      const progress = holdAt(
        tweenProgress(elapsed, tween.forward),
        held,
        tween.forward
      );
      const pose = tweenPose(progress, tween.sun, corner(), wrapperTop(), {
        height: window.innerHeight,
        width: window.innerWidth,
      });
      pinDrift(tween, easeInOut(tween.forward ? progress : 1 - progress));
      setSource(pose.source, pose.disk);
      markActive();
      return;
    }
    if (mode === "blog") {
      const source = cornerCorona(viewPixels());
      uniforms.set("u_disk", 0);
      uniforms.set(
        "u_portrait",
        source.x,
        canvas.height - source.y,
        source.radius
      );
      return;
    }
    if (now - sunAt >= sunEveryMs) refreshSun();
    setSource(sun, 1);
  };

  const retarget = (): void => {
    probe?.dispose();
    targets = modeTargets[mode];
    probe = createSkyProbe(gl, uniforms, targets.length);
    inkNodes = targets.map(() => ({ paint: null, probe: null }));
    lifts = targets.map(() => 0);
    inkSeen = targets.map(() => false);
    probing = false;
    probedAt = -Infinity;
  };

  const inkBox = (slot: number, box: DOMRect): ProbeBox | undefined => {
    const target = targets[slot];
    const nodes = inkNodes[slot];
    if (!target || !nodes) return undefined;
    if (!nodes.probe?.isConnected || !nodes.paint?.isConnected) {
      nodes.probe =
        document.querySelectorAll(target.probe)[target.index] ?? null;
      nodes.paint =
        document.querySelectorAll<HTMLElement>(target.paint)[target.index] ??
        null;
      const lift = lifts[slot] ?? 0;
      if (lift > 0) nodes.paint?.style.setProperty("--lift", lift.toFixed(2));
    }
    if (!nodes.probe) return undefined;
    textRange.selectNodeContents(nodes.probe);
    const area = textRange.getBoundingClientRect();
    const left = Math.max(area.left, box.left);
    const right = Math.min(area.right, box.right);
    const top = Math.max(area.top, box.top);
    const bottom = Math.min(area.bottom, box.bottom);
    if (right - left < 1 || bottom - top < 1) return undefined;
    return {
      bottom: (box.bottom - bottom) * scale,
      left: (left - box.left) * scale,
      right: (right - box.left) * scale,
      top: (box.bottom - top) * scale,
    };
  };

  const readInk = (): void => {
    if (readTimer !== undefined) globalThis.clearTimeout(readTimer);
    readTimer = undefined;
    if (!probe || !probing) return;
    probing = false;
    const pixels = probe.read();
    if (!pixels) return;
    for (const [slot, target] of targets.entries()) {
      const node = inkNodes[slot]?.paint;
      if (!node || inkSeen[slot] !== true) continue;
      const shade = skyLevel(pixels, {
        columns: probe.columns,
        rows: probe.rows,
        slot,
        stride: probe.stride,
      });
      const lift = nextLift(
        lifts[slot] ?? 0,
        liftFor(target.base, shade, target.need)
      );
      if (lift === lifts[slot]) continue;
      lifts[slot] = lift;
      node.style.setProperty("--lift", lift.toFixed(2));
    }
  };

  const wakeProbe = (delay: number): void => {
    if (probeTimer !== undefined) globalThis.clearTimeout(probeTimer);
    probeTimer = globalThis.setTimeout(() => {
      probeTimer = undefined;
      scrolledAt = -Infinity;
      if (!rafId) drawStill();
    }, delay);
  };

  const drawInk = (now: number): void => {
    if (!probe || probing || tween) return;
    if (
      now - scrolledAt < scrollQuietMs ||
      (rafId && now - probedAt < probeEveryMs)
    ) {
      if (!rafId)
        wakeProbe(
          Math.max(
            scrollQuietMs - (now - scrolledAt),
            probeEveryMs - (now - probedAt)
          ) + probeSlackMs
        );
      return;
    }
    probedAt = now;
    const box = canvas.getBoundingClientRect();
    const boxes = targets.map((_, slot) => inkBox(slot, box));
    for (const [slot, area] of boxes.entries())
      inkSeen[slot] = area !== undefined;
    probing = probe.draw(boxes);
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (probing && !rafId)
      readTimer = globalThis.setTimeout(readInk, probeReadMs);
  };

  const uploadPuffs = (): boolean => {
    puffData.fill(0);
    let visible = false;
    for (const [index, puff] of puffs.entries()) {
      const strength = puffStrength(puff);
      puffData.set(
        [puff.x, puff.y, (shiftMs - puff.at) / 1000, strength],
        index * 4
      );
      if (strength > puffVisible) visible = true;
    }
    uniforms.array("u_puffs", puffData);
    uniforms.set("u_puffOn", visible ? 1 : 0);
    return visible;
  };

  const addPuff = (x: number, bottom: number): void => {
    if (
      lastPuff &&
      Math.hypot(x - lastPuff[0], bottom - lastPuff[1]) < puffSpacing
    )
      return;
    lastPuff = [x, bottom];
    const puff = { age: 0, at: shiftMs, x, y: Math.min(bottom, puffTop) };
    if (puffs.length < puffSlots) {
      puffs.push(puff);
      return;
    }
    const strengths = puffs.map((other) => puffStrength(other));
    puffs[strengths.indexOf(Math.min(...strengths))] = puff;
  };

  const fly = (skyMs: number): void => {
    const flight = !crawler && rafId ? (skyMs - meteor.at) / meteorMs : -1;
    if (flight >= 1) launch(skyMs);
    if (flight >= 0 && flight < 1) markActive();
    uniforms.set(
      "u_meteor",
      meteor.x,
      meteor.y,
      meteor.angle,
      flight >= 0 && flight < 1 ? flight : 2
    );
  };

  const unpin = (): void => {
    if (!drift) return;
    delete drift.dataset["skyTween"];
    drift.style.removeProperty("--sky-shift");
    drift.style.removeProperty("--sky-fade-now");
  };

  const clearArrive = (): void => {
    if (arriveTimer !== undefined) globalThis.clearTimeout(arriveTimer);
    arriveTimer = undefined;
    delete root.dataset["skyArrive"];
    root.style.removeProperty("--sky-arrive-delay");
  };

  const finish = (): void => {
    const done = tween;
    if (!done) return;
    tween = undefined;
    delete root.dataset["skyLeave"];
    unpin();
    if (!done.swapped) clearArrive();
    refreshSun();
    probedAt = -Infinity;
    sync();
  };

  const frame = (now: number, dt = frameDt): void => {
    const current = currentLevel();
    if (!current) return;
    if (probing) readInk();
    const skyMs = clock.tick(now);
    const follow = 1 - Math.exp((-followRate * dt) / 1000);
    pointer.x += (pointerTarget.x - pointer.x) * follow;
    pointer.y += (pointerTarget.y - pointer.y) * follow;
    if (rafId) {
      const step = Math.min(dt, 100);
      gust.energy *= Math.exp(-step / 1000 / (gustEaseSeconds / 3));
      const energy = Math.min(gust.energy, 1);
      const boost = (gustMax - 1) * energy * energy * (3 - 2 * energy);
      cloudMs += step;
      shiftMs += step * (1 - boost * gust.dir);
      for (const puff of puffs) puff.age += step / 1000;
      if (gust.energy > gustActive) markActive();
    }
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, triangle);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const puffing = uploadPuffs();
    if (rafId && puffing) markActive();
    uniforms.set("u_res", canvas.width, canvas.height);
    uniforms.set("u_view", viewPixels());
    uniforms.set("u_labPx", labPixelsPerCss / scale);
    uniforms.set("u_time", (skyMs / 1000) % timeWrap);
    uniforms.set("u_pointer", pointer.x, pointer.y);
    placeSource(now);
    uniforms.set("u_clouds", current.clouds ? 1 : 0);
    uniforms.set("u_cloudTime", (cloudMs / 1000) % timeWrap);
    uniforms.set("u_cloudShift", (shiftMs / 1000) % timeWrap);
    uniforms.set(
      "u_daylight",
      look.daylight.day,
      look.daylight.twilight,
      look.daylight.dusk
    );
    uniforms.set(
      "u_weather",
      look.clouds.cover,
      look.clouds.overcast,
      look.clouds.high,
      look.clouds.fog
    );
    fly(skyMs);
    drawInk(now);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (
      tween &&
      held === undefined &&
      tween.swapped &&
      tween.startAt !== undefined &&
      now - tween.startAt >= tweenMs
    )
      finish();
  };

  const drawStill = (): void => {
    clock.pause();
    frame(performance.now());
  };

  const calmClouds = (): void => {
    gust.energy = 0;
    gust.inside = false;
    puffs.length = 0;
    lastPuff = undefined;
  };

  const stop = (): void => {
    if (rafId) globalThis.cancelAnimationFrame(rafId);
    rafId = 0;
    pacer.reset();
    clock.pause();
  };
  const freeze = (now: number): void => {
    frozen = true;
    if (tween) {
      finish();
      return;
    }
    stop();
    frame(now);
    setState("static");
  };
  const loop = (now: number): void => {
    rafId = globalThis.requestAnimationFrame(loop);
    const next = pacer.step(now);
    if (next.kind === "freeze") freeze(now);
    else if (next.kind === "draw") frame(now, next.dt);
  };

  const sync = (): void => {
    stop();
    if (tween) {
      rafId = globalThis.requestAnimationFrame(loop);
      setState("running");
      return;
    }
    if (still || calm || reduceMotion.matches) {
      frame(performance.now());
      setState("static");
      return;
    }
    if (holding) {
      calmClouds();
      setState("paused");
      return;
    }
    if (document.hidden || isSceneHeld()) {
      calmClouds();
      if (!document.hidden) drawStill();
      setState("paused");
      return;
    }
    if (frozen) {
      frame(performance.now());
      setState("static");
      return;
    }
    rafId = globalThis.requestAnimationFrame(loop);
    setState("running");
  };

  const canGlide = (): boolean =>
    !still &&
    !calm &&
    !frozen &&
    !reduceMotion.matches &&
    !isSceneHeld() &&
    !document.hidden;

  const onRouteLeave = (
    event: DocumentEventMap["astro:before-preparation"]
  ): void => {
    finish();
    const next = linkMode(event.to.pathname);
    if (next === undefined || next === mode || !canGlide()) return;
    const [shift, fade] = liveDrift();
    clearArrive();
    const started: Tween = {
      clickAt: performance.now(),
      fade,
      forward: next === "blog",
      shift,
      startAt: undefined,
      sun: sunSpot(instant(), screenView()),
      swapped: false,
    };
    tween = started;
    root.dataset["skyLeave"] = "";
    sync();
    event.signal.addEventListener(
      "abort",
      () => {
        if (tween === started) finish();
      },
      { once: true }
    );
    const load = event.loader;
    event.loader = async (): Promise<void> => {
      await Promise.all([
        load(),
        new Promise((done) => globalThis.setTimeout(done, leaveMs)),
      ]);
    };
  };

  const onRouteSwap = (): void => {
    const next = routeMode(globalThis.location.pathname);
    if (next !== mode) {
      mode = next;
      retarget();
    }
    const active = tween;
    if (!active) {
      refreshSun();
      if (!rafId) drawStill();
      return;
    }
    active.swapped = true;
    if (!active.forward) active.sun = sunSpot(instant(), screenView());
    delete root.dataset["skyLeave"];
    const delay = arriveDelay(performance.now() - active.clickAt);
    root.style.setProperty("--sky-arrive-delay", `${String(delay)}ms`);
    root.dataset["skyArrive"] = "";
    arriveTimer = globalThis.setTimeout(clearArrive, delay + arriveMs + 100);
  };

  const onStill = (): void => {
    if (tween && (reduceMotion.matches || isSceneHeld())) finish();
  };

  const stirClouds = (
    clientX: number,
    clientY: number,
    share: number
  ): void => {
    if (!rafId || !currentLevel()?.clouds) return;
    const [x, y] = toSky(clientX, clientY);
    const bottom = y + canvas.height / 2 / viewPixels();
    const inside = bottom < cloudZone;
    if (bottom < puffZone) addPuff(x, bottom);
    if (inside && gust.inside) {
      const dx = x - gust.x;
      if (gust.energy < gustActive) gust.dir = -1;
      gust.energy = Math.min(
        1,
        gust.energy + Math.hypot(dx, (y - gust.y) * share) * gustGain
      );
      if (Math.abs(dx) > 0.002)
        gust.dir += (Math.sign(dx) - gust.dir) * Math.min(1, Math.abs(dx) * 12);
    }
    gust.inside = inside;
    gust.x = x;
    gust.y = y;
  };

  const onPointer = (event: PointerEvent): void => {
    markActive();
    if (reduceMotion.matches || isSceneHeld()) return;
    if (event.pointerType !== "touch")
      stirClouds(event.clientX, event.clientY, 1);
    if (!hoverPointer.matches) return;
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    pointerTarget.x =
      (event.clientX / window.innerWidth - 0.5) * parallaxReach * aspect;
    pointerTarget.y =
      (0.5 - event.clientY / window.innerHeight) * parallaxReach;
  };
  const applyResize = (): void => {
    resizeTimer = undefined;
    markActive();
    resize();
    refreshSun();
    if (!rafId) drawStill();
  };
  const onResize = (): void => {
    if (resizeTimer !== undefined) globalThis.clearTimeout(resizeTimer);
    resizeTimer = globalThis.setTimeout(applyResize, resizeDelayMs);
  };
  const onLeave = (event: PointerEvent): void => {
    if (event.relatedTarget !== null) return;
    gust.inside = false;
    lastPuff = undefined;
  };
  const onTouch = (event: TouchEvent): void => {
    const touch = event.touches[0];
    if (!touch || reduceMotion.matches || isSceneHeld()) return;
    stirClouds(touch.clientX, touch.clientY, touchScrollShare);
  };
  const onLift = (): void => {
    gust.inside = false;
    lastPuff = undefined;
  };
  const placeDrift = (): void => {
    driftFrame = 0;
    if (!drift) return;
    const moving =
      !calm &&
      !reduceMotion.matches &&
      !root.hasAttribute(motionPausedAttribute);
    const travel = moving
      ? Math.min(window.scrollY, window.innerHeight) * driftShare
      : 0;
    const head = Math.min(
      fadeHeadPx[1],
      Math.max(fadeHeadPx[0], window.innerHeight * fadeHeadShare)
    );
    drift.style.translate = `0 ${String(-Math.round(travel))}px`;
    drift.style.setProperty(
      "--sky-fade",
      Math.min(1, window.scrollY / head).toFixed(3)
    );
  };
  const onScroll = (): void => {
    scrolledAt = performance.now();
    if (scriptDrift && !driftFrame)
      driftFrame = globalThis.requestAnimationFrame(placeDrift);
    if (!rafId && !holding) wakeProbe(scrollQuietMs);
  };
  const onShift = (event: TransitionEvent): void => {
    if (
      !rafId &&
      event.target instanceof Element &&
      event.target.id === "main-content"
    )
      drawStill();
  };
  const onHold = (entries: IntersectionObserverEntry[]): void => {
    const entry = entries.at(-1);
    if (entry === undefined) return;
    const deep = !entry.isIntersecting;
    if (deep === holding) return;
    holding = deep;
    sync();
  };
  const onBlur = (): void => {
    if (tween) return;
    stop();
    setState("paused");
  };
  const onDriftChange = (): void => {
    if (scriptDrift) placeDrift();
  };

  resize();
  retarget();
  refreshSun();
  launch(0);
  frame(performance.now());
  sync();

  const sizeWatch = new ResizeObserver(onResize);
  sizeWatch.observe(canvas);
  const holdWatch = new IntersectionObserver(onHold);
  const sentinel = document.querySelector("[data-sky-sentinel]");
  if (sentinel) holdWatch.observe(sentinel);
  if (scriptDrift) {
    placeDrift();
    globalThis.addEventListener(sceneHoldEvent, onDriftChange);
    reduceMotion.addEventListener("change", onDriftChange);
  }
  document.addEventListener("astro:before-preparation", onRouteLeave);
  document.addEventListener("astro:after-swap", onRouteSwap);
  document.addEventListener("transitionend", onShift);
  window.addEventListener("resize", onResize);
  window.addEventListener("scroll", onScroll, { passive: true });
  globalThis.addEventListener("pointermove", onPointer, { passive: true });
  globalThis.addEventListener("pointerout", onLeave, { passive: true });
  globalThis.addEventListener("pointerup", onLift, { passive: true });
  globalThis.addEventListener("touchmove", onTouch, { passive: true });
  globalThis.addEventListener("touchend", onLift, { passive: true });
  globalThis.addEventListener("touchcancel", onLift, { passive: true });
  window.addEventListener("blur", onBlur);
  window.addEventListener("focus", sync);
  globalThis.addEventListener(sceneHoldEvent, sync);
  globalThis.addEventListener(sceneHoldEvent, onStill);
  document.addEventListener("visibilitychange", sync);
  reduceMotion.addEventListener("change", sync);
  reduceMotion.addEventListener("change", onStill);
  return () => {
    stop();
    tween = undefined;
    delete root.dataset["skyLeave"];
    clearArrive();
    unpin();
    document.removeEventListener("astro:before-preparation", onRouteLeave);
    document.removeEventListener("astro:after-swap", onRouteSwap);
    document.removeEventListener("transitionend", onShift);
    if (resizeTimer !== undefined) globalThis.clearTimeout(resizeTimer);
    if (probeTimer !== undefined) globalThis.clearTimeout(probeTimer);
    if (readTimer !== undefined) globalThis.clearTimeout(readTimer);
    sizeWatch.disconnect();
    holdWatch.disconnect();
    if (driftFrame) globalThis.cancelAnimationFrame(driftFrame);
    globalThis.removeEventListener(sceneHoldEvent, onDriftChange);
    reduceMotion.removeEventListener("change", onDriftChange);
    probe?.dispose();
    gl.deleteBuffer(triangle);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("scroll", onScroll);
    globalThis.removeEventListener("pointermove", onPointer);
    globalThis.removeEventListener("pointerout", onLeave);
    globalThis.removeEventListener("pointerup", onLift);
    globalThis.removeEventListener("touchmove", onTouch);
    globalThis.removeEventListener("touchend", onLift);
    globalThis.removeEventListener("touchcancel", onLift);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("focus", sync);
    globalThis.removeEventListener(sceneHoldEvent, sync);
    globalThis.removeEventListener(sceneHoldEvent, onStill);
    document.removeEventListener("visibilitychange", sync);
    reduceMotion.removeEventListener("change", sync);
    reduceMotion.removeEventListener("change", onStill);
  };
};

export const SpaceBackground = (): ReactElement => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reduceMotion = globalThis.matchMedia(reducedMotionQuery);
    const setState = (state: SpaceState): void => {
      canvas.dataset["spaceState"] = state;
    };
    const fallback = (): void => {
      canvas.hidden = true;
      setState("fallback");
    };
    const gl = canvas.getContext("webgl", contextOptions);
    const still = gl ? isSoftwareRenderer(gl) : false;
    const vertex = gl
      ? createShader(gl, gl.VERTEX_SHADER, skyVertexShader)
      : undefined;
    const fragment = gl
      ? createShader(gl, gl.FRAGMENT_SHADER, longRaysShader)
      : undefined;
    const program = gl?.createProgram();
    if (!gl || !vertex || !fragment || !program) {
      fallback();
      return;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);

    let stopSky: (() => void) | undefined;
    const cancelWait = whenLinked(gl, program, (linked) => {
      if (!linked) {
        fallback();
        return;
      }
      stopSky = startSky(gl, program, canvas, reduceMotion, still, setState);
    });
    return () => {
      cancelWait();
      stopSky?.();
      releaseProgram(gl, program, [vertex, fragment]);
      releaseWhenDetached(gl, canvas);
    };
  }, []);

  return (
    <>
      <div aria-hidden="true" data-blog-sky="">
        <canvas
          aria-hidden="true"
          data-space=""
          data-space-state="init"
          ref={ref}
        />
        <div data-sky-fade="" />
      </div>
      <div aria-hidden="true" data-sky-sentinel="" />
    </>
  );
};
