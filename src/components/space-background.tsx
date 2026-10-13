"use client";

import { type ReactElement, useEffect, useRef } from "react";

import {
  createUniformSink,
  fanOut,
  type LayerPlacement,
  placeLayer,
  type UniformSink,
} from "@/lib/corona-layer";
import { isCrawler } from "@/lib/crawler";
import { createFrameClock } from "@/lib/frame-clock";
import { createFramePacer } from "@/lib/frame-pacer";
import { finePointerQuery, reducedMotionQuery } from "@/lib/media";
import { isSceneHeld, sceneHoldEvent } from "@/lib/scene-hold";
import { nightPhase, type SkyPhase, skyPhase } from "@/lib/sky-clock";
import {
  blogIndexInkTargets,
  type InkTarget,
  inkTargets,
  liftFor,
  nextLift,
  postInkTargets,
  skyLevel,
} from "@/lib/sky-ink";
import {
  forgetSkyPreset,
  presetLook,
  readSkyPreset,
  type SkyLook,
  type SkyMode,
  type SkyPreset,
  skyPresetEvent,
  startingSkyPreset,
} from "@/lib/sky-preset";
import { createSkyProbe, type ProbeBox } from "@/lib/sky-probe";
import { cornerCorona, cornerMeteor, longRaysShader } from "@/lib/sky-rays";
import {
  coronaFragmentShader as CORONA,
  skyFragmentShader as FRAGMENT,
  skyVertexShader as VERTEX,
} from "@/lib/sky-shader";
import {
  crawlerSky,
  fallbackSky,
  fetchSkyWeather,
  type SkyWeather,
  weatherOverride,
} from "@/lib/weather";
import { isSoftwareRenderer } from "@/lib/webgl";

interface CoronaLayer {
  dispose: () => void;
  draw: (place: LayerPlacement) => void;
  hide: () => void;
  onLost: (handler: () => void) => void;
  ready: () => boolean;
  sink: () => undefined | UniformSink;
  stage: HTMLElement;
}

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

interface SkyOptions {
  mode: SkyMode;
  preset: SkyPreset | undefined;
}

interface SpaceBackgroundProps {
  mode?: SkyMode;
  preset?: SkyPreset;
}

type SpaceState = "fallback" | "paused" | "running" | "static";

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
const meteorMs = 1450;
const meteorGapMs: [number, number] = [2000, 14_000];
const postMeteorMs = 1600;
const postMeteorGapMs = 4400;
const postMeteorRoom = 0.55;
const timeWrapHighSeconds = 86_400;
const timeWrapLowSeconds = 1024;
const portraitSelector = "[data-eclipse]";
const probeEveryMs = 1000;
const scrollQuietMs = 180;
const probeReadMs = 34;
const probeSlackMs = 5;
const layerReach = 7.6;
const cloudZone = 0.8;
const gustMax = 3.5;
const gustEaseSeconds = 2.3;
const gustGain = 1.8;
const gustActive = 0.01;
const touchScrollShare = 0.25;
const daylightEveryMs = 30_000;
const daylightSettled = 0.001;
const puffSlots = 10;
const puffSpacing = 0.11;
const puffZone = 0.55;
const puffTop = 0.3;
const puffRiseSeconds = 0.7;
const puffAmount = 0.9;
const puffSettleSeconds = 4;
const puffVisible = 0.003;
const weatherEveryMs = 900_000;
const weatherEaseSeconds = 3;
const weatherKeys: Array<keyof SkyWeather> = [
  "cover",
  "drift",
  "fog",
  "high",
  "overcast",
  "rain",
  "slant",
  "snow",
  "storm",
];
const daylightKeys: Array<keyof SkyPhase> = ["day", "dusk", "twilight"];
const modeTargets: Readonly<Record<SkyMode, readonly InkTarget[]>> = {
  home: inkTargets,
  index: blogIndexInkTargets,
  post: postInkTargets,
};
const modeStages: Readonly<Record<SkyMode, string>> = {
  home: "[data-card]",
  index: "[data-blog-index]",
  post: "[data-sky-header]",
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

const nextGap = (): number =>
  meteorGapMs[0] + Math.random() * (meteorGapMs[1] - meteorGapMs[0]);

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

const createCoronaLayer = (
  stage: HTMLElement,
  canvas: HTMLCanvasElement
): CoronaLayer | undefined => {
  const gl = canvas.getContext("webgl", contextOptions);
  const vertex = gl ? createShader(gl, gl.VERTEX_SHADER, VERTEX) : undefined;
  const fragment = gl
    ? createShader(gl, gl.FRAGMENT_SHADER, CORONA)
    : undefined;
  const program = gl?.createProgram();
  if (!gl || !vertex || !fragment || !program) return undefined;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  let sink: undefined | UniformSink;
  let shown: LayerPlacement | undefined;
  let triangle: null | WebGLBuffer = null;
  let onLost = (): void => undefined;
  const cancelWait = whenLinked(gl, program, (linked) => {
    if (!linked || gl.isContextLost()) return;
    triangle = bindTriangle(gl, program);
    sink = createUniformSink(gl, program);
  });
  const hide = (): void => {
    delete stage.dataset["live"];
    shown = undefined;
  };
  const onContextLost = (): void => {
    sink = undefined;
    hide();
    onLost();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);
  const draw = (place: LayerPlacement): void => {
    if (!sink) return;
    if (canvas.width !== place.width || canvas.height !== place.height) {
      canvas.width = place.width;
      canvas.height = place.height;
      gl.viewport(0, 0, place.width, place.height);
    }
    if (
      shown?.left !== place.left ||
      shown.top !== place.top ||
      shown.cssWidth !== place.cssWidth ||
      shown.cssHeight !== place.cssHeight
    ) {
      canvas.style.transform = `translate(${String(place.left)}px, ${String(place.top)}px)`;
      canvas.style.width = `${String(place.cssWidth)}px`;
      canvas.style.height = `${String(place.cssHeight)}px`;
    }
    sink.set("u_origin", place.originX, place.originY);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    stage.dataset["live"] = "";
    shown = place;
  };
  return {
    dispose: () => {
      cancelWait();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      hide();
      sink = undefined;
      gl.deleteBuffer(triangle);
      releaseProgram(gl, program, [vertex, fragment]);
      releaseWhenDetached(gl, canvas);
    },
    draw,
    hide,
    onLost: (handler) => {
      onLost = handler;
    },
    ready: () => sink !== undefined,
    sink: () => sink,
    stage,
  };
};

const startSky = (
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  canvas: HTMLCanvasElement,
  reduceMotion: MediaQueryList,
  still: boolean,
  layer: CoronaLayer | undefined,
  setState: (state: SpaceState) => void,
  { mode, preset }: SkyOptions
): (() => void) => {
  const anchored = mode === "post";
  const targets = modeTargets[mode];
  const triangle = bindTriangle(gl, program);
  const sky = createUniformSink(gl, program);
  const uniforms = fanOut([() => sky, () => layer?.sink()]);
  const probe = createSkyProbe(gl, sky, targets.length);
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
  let portraitNode: Element | null = null;
  let placement: LayerPlacement | undefined;
  let split = false;
  const inkNodes: InkNodes[] = targets.map(() => ({
    paint: null,
    probe: null,
  }));
  const lifts = targets.map(() => 0);
  const inkSeen = targets.map(() => false);
  const textRange = document.createRange();
  let probedAt = performance.now();
  let scrolledAt = -Infinity;
  let probeTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let readTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let probing = false;
  const pointer = { x: 0, y: 0 };
  const pointerTarget = { x: 0, y: 0 };
  const meteor = { angle: 0, at: 0, x: 0, y: 0 };
  const flightMs = anchored ? postMeteorMs : meteorMs;
  const gust = { dir: -1, energy: 0, inside: false, x: 0, y: 0 };
  let cloudMs = 0;
  let shiftMs = 0;
  const override = weatherOverride(globalThis.location.search);
  const crawler = !override && isCrawler(navigator.userAgent);
  const fixedLook = anchored && preset ? presetLook(preset) : undefined;
  const clockLive = !crawler && !anchored;
  const liveDaylight: SkyPhase = clockLive
    ? skyPhase(new Date())
    : { ...(crawler ? nightPhase : (fixedLook?.daylight ?? nightPhase)) };
  let daylightAt = performance.now();
  const liveWeather: SkyWeather = {
    ...(override ??
      (crawler ? crawlerSky : (fixedLook?.weather ?? fallbackSky))),
  };
  const waiting = startingSkyPreset(mode, crawler);
  let heldLook: SkyLook | undefined = waiting ? presetLook(waiting) : undefined;
  const weatherTarget: SkyWeather = {
    ...(override ?? heldLook?.weather ?? liveWeather),
  };
  const weather: SkyWeather = { ...weatherTarget };
  const daylightTarget: SkyPhase = { ...(heldLook?.daylight ?? liveDaylight) };
  const daylight: SkyPhase = { ...daylightTarget };
  const meteorShown = !anchored || (!crawler && weatherTarget.overcast < 1);
  let offscreen = false;
  let daylightEasing = false;
  const weatherStop = new AbortController();
  const puffs: Puff[] = [];
  const puffData = new Float32Array(puffSlots * 4);
  let lastPuff: [number, number] | undefined;
  let scrollFrame = 0;
  const clock = createFrameClock();
  const hoverPointer = globalThis.matchMedia(finePointerQuery);
  let resizeTimer: ReturnType<typeof globalThis.setTimeout> | undefined;

  const viewPixels = (): number => Math.max(1, canvas.height);

  const toSky = (clientX: number, clientY: number): [number, number] => {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * scale;
    const y = (rect.bottom - clientY) * scale;
    const view = viewPixels();
    return [(x - canvas.width / 2) / view, (y - canvas.height / 2) / view];
  };

  const launch = (now: number): void => {
    if (anchored) {
      const halfWidth = canvas.width / viewPixels() / 2;
      Object.assign(meteor, cornerMeteor, {
        at: now + postMeteorGapMs,
        x: Math.min(cornerMeteor.x, halfWidth - postMeteorRoom),
      });
      return;
    }
    meteor.at = now + nextGap();
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const [, centerY] = toSky(window.innerWidth / 2, window.innerHeight / 2);
    const side = Math.random() < 0.5 ? -1 : 1;
    const tilt = 0.35 + Math.random() * 0.35;
    meteor.x = side * (0.15 + Math.random() * 0.3) * aspect;
    meteor.y = centerY + 0.25 + Math.random() * 0.2;
    meteor.angle = side < 0 ? -tilt : Math.PI + tilt;
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

  const trackPortrait = (): DOMRect | undefined => {
    if (anchored) {
      const source = cornerCorona(canvas.height);
      uniforms.set(
        "u_portrait",
        source.x,
        canvas.height - source.y,
        source.radius
      );
      return undefined;
    }
    if (!portraitNode?.isConnected)
      portraitNode = document.querySelector(portraitSelector);
    if (!portraitNode) {
      uniforms.set("u_portrait", 0, 0, 0);
      return undefined;
    }
    const box = canvas.getBoundingClientRect();
    const face = portraitNode.getBoundingClientRect();
    uniforms.set(
      "u_portrait",
      (face.left + face.width / 2 - box.left) * scale,
      (box.bottom - face.top - face.height / 2) * scale,
      (face.width / 2) * scale
    );
    return face;
  };

  const placeCorona = (
    face: DOMRect | undefined
  ): LayerPlacement | undefined => {
    if (!face || !layer?.ready() || face.width <= 0) return undefined;
    const root = document.documentElement;
    if (root.scrollHeight - root.clientHeight < 1) return undefined;
    const box = canvas.getBoundingClientRect();
    placement = placeLayer({
      face,
      pitchX: canvas.width / Math.max(1, box.width),
      pitchY: canvas.height / Math.max(1, box.height),
      previous: placement,
      reach: layerReach,
      sky: box,
      stage: layer.stage.getBoundingClientRect(),
    });
    return placement;
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
      const light = skyLevel(pixels, {
        columns: probe.columns,
        rows: probe.rows,
        slot,
        stride: probe.stride,
      });
      const lift = nextLift(
        lifts[slot] ?? 0,
        liftFor(target.base, light, target.need)
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
    if (!probe || probing) return;
    if (now - scrolledAt < scrollQuietMs || now - probedAt < probeEveryMs) {
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
    sky.set("u_split", 0);
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

  const refreshWeather = (): void => {
    if (
      override ||
      crawler ||
      anchored ||
      process.env.NODE_ENV !== "production"
    )
      return;
    void fetchSkyWeather(weatherStop.signal).then((next) => {
      if (!next || weatherStop.signal.aborted) return;
      Object.assign(liveWeather, next);
      if (heldLook) return;
      Object.assign(weatherTarget, next);
      if (rafId) {
        markActive();
        return;
      }
      Object.assign(weather, next);
      if (!document.hidden) drawStill();
    });
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
      const ease = 1 - Math.exp(-step / 1000 / weatherEaseSeconds);
      for (const key of weatherKeys)
        weather[key] += (weatherTarget[key] - weather[key]) * ease;
      for (const key of daylightKeys)
        daylight[key] += (daylightTarget[key] - daylight[key]) * ease;
      if (
        daylightEasing &&
        daylightKeys.every(
          (key) =>
            Math.abs(daylightTarget[key] - daylight[key]) < daylightSettled
        )
      )
        daylightEasing = false;
      cloudMs += step;
      shiftMs += step * (weather.drift - boost * gust.dir);
      for (const puff of puffs) puff.age += step / 1000;
      if (gust.energy > gustActive) markActive();
    }
    const puffing = uploadPuffs();
    if (rafId && puffing) markActive();
    uniforms.set("u_res", canvas.width, canvas.height);
    uniforms.set("u_view", viewPixels());
    uniforms.set("u_labPx", labPixelsPerCss / scale);
    uniforms.set("u_time", (skyMs / 1000) % timeWrap);
    uniforms.set("u_pointer", pointer.x, pointer.y);
    const face = trackPortrait();
    uniforms.set("u_clouds", current.clouds ? 1 : 0);
    uniforms.set("u_cloudTime", (cloudMs / 1000) % timeWrap);
    uniforms.set("u_cloudShift", (shiftMs / 1000) % timeWrap);
    if (clockLive && now - daylightAt >= daylightEveryMs) {
      Object.assign(liveDaylight, skyPhase(new Date()));
      daylightAt = now;
      if (!heldLook) {
        Object.assign(daylightTarget, liveDaylight);
        if (!daylightEasing) Object.assign(daylight, liveDaylight);
      }
    }
    uniforms.set("u_daylight", daylight.day, daylight.twilight, daylight.dusk);
    uniforms.set(
      "u_weather",
      weather.cover,
      weather.overcast,
      weather.high,
      weather.fog
    );
    uniforms.set(
      "u_fall",
      weather.rain,
      weather.snow,
      weather.storm,
      weather.slant
    );
    const flight = rafId && meteorShown ? (skyMs - meteor.at) / flightMs : -1;
    if (flight >= 1) launch(skyMs);
    if (flight >= 0 && flight < 1) markActive();
    uniforms.set(
      "u_meteor",
      meteor.x,
      meteor.y,
      meteor.angle,
      flight >= 0 && flight < 1 ? flight : 2
    );
    const place = placeCorona(face);
    drawInk(now);
    split = place !== undefined;
    sky.set("u_split", split ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (place) layer?.draw(place);
    else layer?.hide();
  };

  const drawStill = (): void => {
    if (offscreen) return;
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
    Object.assign(weather, weatherTarget);
    Object.assign(daylight, daylightTarget);
    daylightEasing = false;
  };
  const freeze = (now: number): void => {
    frozen = true;
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
    if (offscreen) {
      calmClouds();
      setState("paused");
      return;
    }
    if (still || reduceMotion.matches) {
      frame(performance.now());
      setState("static");
      return;
    }
    if (document.hidden || isSceneHeld()) {
      calmClouds();
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
      if (gust.energy < gustActive) gust.dir = weather.drift < 0 ? 1 : -1;
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
  const onScroll = (): void => {
    scrolledAt = performance.now();
    if (anchored) return;
    if (!rafId) wakeProbe(scrollQuietMs);
    if (split) return;
    if (rafId) {
      markActive();
      return;
    }
    if (scrollFrame) return;
    scrollFrame = globalThis.requestAnimationFrame(() => {
      scrollFrame = 0;
      drawStill();
    });
  };
  const onShift = (event: TransitionEvent): void => {
    if (!rafId && event.target === event.currentTarget) drawStill();
  };
  const onBlur = (): void => {
    stop();
    setState("paused");
  };
  const showPreset = (next: null | SkyPreset): void => {
    heldLook = next ? presetLook(next) : undefined;
    Object.assign(weatherTarget, override ?? heldLook?.weather ?? liveWeather);
    Object.assign(daylightTarget, heldLook?.daylight ?? liveDaylight);
    if (rafId) {
      daylightEasing = true;
      markActive();
      return;
    }
    Object.assign(weather, weatherTarget);
    Object.assign(daylight, daylightTarget);
    if (!document.hidden) drawStill();
  };
  const onPreset = (event: Event): void => {
    const next = readSkyPreset(event);
    if (next === undefined || crawler) return;
    showPreset(next);
  };
  const onView = (entries: IntersectionObserverEntry[]): void => {
    const entry = entries.at(-1);
    if (entry === undefined) return;
    const hidden = !entry.isIntersecting;
    if (hidden === offscreen) return;
    offscreen = hidden;
    sync();
  };

  layer?.onLost(() => {
    if (!rafId) drawStill();
  });
  resize();
  launch(0);
  refreshWeather();
  frame(performance.now());
  sync();
  const weatherTimer = globalThis.setInterval(refreshWeather, weatherEveryMs);

  const sizeWatch = new ResizeObserver(onResize);
  sizeWatch.observe(canvas);
  const card = document.querySelector(modeStages[mode]);
  if (card) sizeWatch.observe(card);
  const viewWatch = anchored ? new IntersectionObserver(onView) : undefined;
  viewWatch?.observe(canvas);
  if (mode === "index") globalThis.addEventListener(skyPresetEvent, onPreset);
  const main = document.querySelector<HTMLElement>("#main-content");
  main?.addEventListener("transitionend", onShift);
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
  document.addEventListener("visibilitychange", sync);
  reduceMotion.addEventListener("change", sync);
  return () => {
    stop();
    layer?.dispose();
    weatherStop.abort();
    globalThis.clearInterval(weatherTimer);
    main?.removeEventListener("transitionend", onShift);
    if (scrollFrame) globalThis.cancelAnimationFrame(scrollFrame);
    if (resizeTimer !== undefined) globalThis.clearTimeout(resizeTimer);
    if (probeTimer !== undefined) globalThis.clearTimeout(probeTimer);
    if (readTimer !== undefined) globalThis.clearTimeout(readTimer);
    sizeWatch.disconnect();
    viewWatch?.disconnect();
    globalThis.removeEventListener(skyPresetEvent, onPreset);
    if (mode === "index") forgetSkyPreset();
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
    document.removeEventListener("visibilitychange", sync);
    reduceMotion.removeEventListener("change", sync);
  };
};

export const SpaceBackground = ({
  mode = "home",
  preset,
}: SpaceBackgroundProps): ReactElement => {
  const ref = useRef<HTMLCanvasElement>(null);
  const presetPhase = preset?.phase;
  const presetWeather = preset?.weather;
  const stageRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const stage = stageRef.current;
    const layerCanvas = layerRef.current;
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
    const vertex = gl ? createShader(gl, gl.VERTEX_SHADER, VERTEX) : undefined;
    const fragment = gl
      ? createShader(
          gl,
          gl.FRAGMENT_SHADER,
          mode === "post" ? longRaysShader : FRAGMENT
        )
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
    const release = (): void => {
      releaseProgram(gl, program, [vertex, fragment]);
      releaseWhenDetached(gl, canvas);
    };
    const cancelWait = whenLinked(gl, program, (linked) => {
      if (!linked) {
        fallback();
        return;
      }
      const layer =
        still || mode === "post" || !stage || !layerCanvas
          ? undefined
          : createCoronaLayer(stage, layerCanvas);
      stopSky = startSky(
        gl,
        program,
        canvas,
        reduceMotion,
        still,
        layer,
        setState,
        {
          mode,
          preset:
            presetPhase && presetWeather
              ? { phase: presetPhase, weather: presetWeather }
              : undefined,
        }
      );
    });
    return () => {
      cancelWait();
      stopSky?.();
      release();
    };
  }, [mode, presetPhase, presetWeather]);

  return (
    <>
      <canvas
        aria-hidden="true"
        data-space=""
        data-space-state="init"
        ref={ref}
      />
      {mode === "post" ? undefined : (
        <div aria-hidden="true" data-corona="" ref={stageRef}>
          <canvas ref={layerRef} />
        </div>
      )}
    </>
  );
};
