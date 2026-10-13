"use client";

import { type ReactElement, useEffect, useRef } from "react";

import type { Skyline } from "@/lib/skyline";
import type { SkylineGl } from "@/lib/skyline-gl";

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
import { nightPhase, type SkyPhase } from "@/lib/sky-clock";
import {
  type InkTarget,
  inkTargets,
  liftFor,
  nextLift,
  postInkTargets,
  skyLevel,
} from "@/lib/sky-ink";
import {
  crawlerInstant,
  instantOverride,
  type SkyLight,
  skyLight,
  type SkyView,
} from "@/lib/sky-light";
import { blogLook, type SkyMode } from "@/lib/sky-preset";
import { createSkyProbe, type ProbeBox } from "@/lib/sky-probe";
import { cornerCorona, cornerMeteor, longRaysShader } from "@/lib/sky-rays";
import {
  addWorldPuff,
  agePuffs,
  cameraFor,
  easeLean,
  easeLook,
  type Hover,
  landmarkUniforms,
  lookTarget,
  pickLandmark,
  puffUniforms,
  settleLean,
  windGain,
  type WorldPuff,
  worldPuff,
} from "@/lib/sky-scene";
import {
  homeSkyFragmentShader as HOME,
  skyVertexShader as VERTEX,
} from "@/lib/sky-shader";
import { createUniformSink } from "@/lib/uniform-sink";
import {
  crawlerSky,
  fallbackSky,
  fetchSkyWeather,
  type SkyWeather,
  weatherOverride,
} from "@/lib/weather";
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

interface SpaceBackgroundProps {
  mode?: SkyMode;
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
const windWrapHighSeconds = 7200;
const wheelTurnSeconds = 255;
const wheelSpeed = 4;
const skylineIdleMs = 2000;
const settleMs = 1500;
const homePuffZone = 0.55;
const lookShare = 0.6;
const pointSize = 7;
const openTargets = "main, #main-content, [data-card], [data-space]";
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

const homeContextOptions: WebGLContextAttributes = {
  ...contextOptions,
  antialias: true,
  depth: true,
};

const groundShare = (amount: number): number => {
  const t = Math.min(1, Math.max(0, amount / 0.1));
  return t * t * (3 - 2 * t);
};

const whenIdle = (task: () => void): (() => void) => {
  if ("requestIdleCallback" in globalThis) {
    const handle = globalThis.requestIdleCallback(task, {
      timeout: skylineIdleMs,
    });
    return () => {
      globalThis.cancelIdleCallback(handle);
    };
  }
  const timer = globalThis.setTimeout(task, skylineIdleMs / 4);
  return () => {
    globalThis.clearTimeout(timer);
  };
};

const startSky = (
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  canvas: HTMLCanvasElement,
  reduceMotion: MediaQueryList,
  still: boolean,
  setState: (state: SpaceState) => void,
  mode: SkyMode
): (() => void) => {
  const anchored = mode === "blog";
  const drift = anchored ? canvas.parentElement : null;
  const targets = modeTargets[mode];
  const home = !anchored;
  const triangle = bindTriangle(gl, program);
  const position = gl.getAttribLocation(program, "a_pos");
  const uniforms = createUniformSink(gl, program);
  const probe = createSkyProbe(gl, uniforms, targets.length);
  const highPrecision =
    (gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)
      ?.precision ?? 0) > 0;
  const timeWrap = highPrecision ? timeWrapHighSeconds : timeWrapLowSeconds;
  const windWrap = highPrecision ? windWrapHighSeconds : timeWrapLowSeconds;

  let level = 0;
  const currentLevel = (): QualityLevel | undefined =>
    still ? softwareLevel : (LEVELS[level] ?? LEVELS[0]);
  let scale = 1;
  let rafId = 0;
  let frozen = false;
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
  const fixedLook = anchored ? blogLook() : undefined;
  const calm = anchored && (crawler || prefersLightLoad());
  if (calm && drift) drift.dataset["skyStill"] = "";
  const clockLive = !crawler && !anchored;
  const pinned = instantOverride(globalThis.location.search);
  const instant = (): number =>
    crawler ? crawlerInstant : (pinned ?? Date.now());
  const liveWeather: SkyWeather = {
    ...(override ??
      (crawler ? crawlerSky : (fixedLook?.weather ?? fallbackSky))),
  };
  const weatherTarget: SkyWeather = { ...(override ?? liveWeather) };
  const weather: SkyWeather = { ...weatherTarget };
  const cardNode = home ? document.querySelector("[data-card]") : null;
  const widthNode = home ? document.querySelector("[data-card] .bio") : null;
  const cardRange = document.createRange();
  const lightView = (): SkyView => {
    const box = canvas.getBoundingClientRect();
    const view: SkyView = { height: box.height, width: box.width };
    const card = cardNode?.getBoundingClientRect();
    if (!card || card.width <= 0) return view;
    let { left, right } = card;
    if (widthNode) {
      cardRange.selectNodeContents(widthNode);
      const text = cardRange.getBoundingClientRect();
      if (text.width > 0) ({ left, right } = text);
    }
    view.card = {
      bottom: card.bottom - box.top,
      left: left - box.left,
      right: right - box.left,
      top: card.top - box.top,
    };
    return view;
  };
  let light: SkyLight | undefined = home
    ? skyLight(instant(), weatherTarget, lightView())
    : undefined;
  const liveDaylight: SkyPhase = light
    ? { ...light.daylight }
    : { ...(crawler ? nightPhase : (fixedLook?.daylight ?? nightPhase)) };
  let daylightAt = performance.now();
  const textRects = new Float32Array(targets.length * 4);
  const look: [number, number] = [0, 0];
  let pointerAt: [number, number] | undefined;
  let pointerPx: [number, number] | undefined;
  let hover: Hover | undefined;
  let worldPuffs: WorldPuff[] = [];
  let wheel = 0;
  let skyline: Skyline | undefined;
  let skylineGl: SkylineGl | undefined;
  let gone = false;
  let landmarkData: Float32Array<ArrayBuffer> = new Float32Array(0);
  const skylineWanted = home && !still && !prefersLightLoad();
  const daylightTarget: SkyPhase = { ...liveDaylight };
  const daylight: SkyPhase = { ...daylightTarget };
  const meteorShown = !anchored || (!crawler && weatherTarget.overcast < 1);
  let holding = false;
  let daylightEasing = false;
  let driftFrame = 0;
  const scriptDrift =
    anchored &&
    drift !== null &&
    !CSS.supports("animation-timeline", "scroll()");
  const weatherStop = new AbortController();
  const puffs: Puff[] = [];
  const puffData = new Float32Array(puffSlots * 4);
  let lastPuff: [number, number] | undefined;
  const clock = createFrameClock();
  const hoverPointer = globalThis.matchMedia(finePointerQuery);
  let resizeTimer: ReturnType<typeof globalThis.setTimeout> | undefined;

  const rayView = (): number =>
    Math.round(
      Math.min(window.innerHeight * rayViewShare, rayViewMaxCss) * scale
    );
  const viewPixels = (): number =>
    Math.max(1, anchored ? Math.min(canvas.height, rayView()) : canvas.height);

  const toSky = (clientX: number, clientY: number): [number, number] => {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * scale;
    const y = (rect.bottom - clientY) * scale;
    const view = viewPixels();
    return [(x - canvas.width / 2) / view, (y - canvas.height / 2) / view];
  };

  const launch = (now: number): void => {
    if (anchored) {
      const view = viewPixels();
      const halfWidth = canvas.width / view / 2;
      Object.assign(meteor, cornerMeteor, {
        at: now + postMeteorGapMs,
        x: Math.min(cornerMeteor.x, halfWidth - postMeteorRoom),
        y: canvas.height / view / 2 - (0.5 - cornerMeteor.y),
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

  const trackCorner = (): void => {
    if (!anchored) return;
    const source = cornerCorona(viewPixels());
    uniforms.set(
      "u_portrait",
      source.x,
      canvas.height - source.y,
      source.radius
    );
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
    if (!probe || probing) return;
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
    for (const [slot, area] of boxes.entries()) {
      inkSeen[slot] = area !== undefined;
      textRects.set(
        area ? [area.left, area.bottom, area.right, area.top] : [0, 0, 0, 0],
        slot * 4
      );
    }
    if (home) uniforms.array("u_txt", textRects);
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

  const addPuff = (
    x: number,
    bottom: number,
    clientX: number,
    clientY: number
  ): void => {
    if (
      lastPuff &&
      Math.hypot(x - lastPuff[0], bottom - lastPuff[1]) < puffSpacing
    )
      return;
    lastPuff = [x, bottom];
    if (home) {
      const box = canvas.getBoundingClientRect();
      const shift = (shiftMs / 1000) % windWrap;
      worldPuffs = addWorldPuff(
        worldPuffs,
        worldPuff(
          (clientX - box.left) / Math.max(1, box.width),
          (clientY - box.top) / Math.max(1, box.height),
          box.width / Math.max(1, box.height),
          cameraFor(box.width, box.height),
          [windGain[0] * shift, windGain[1] * shift]
        )
      );
      return;
    }
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
      Object.assign(weatherTarget, next);
      refreshLight();
      if (rafId) {
        markActive();
        return;
      }
      Object.assign(weather, next);
      if (!document.hidden) drawStill();
    });
  };

  const refreshLight = (): void => {
    if (!home) return;
    light = skyLight(instant(), weatherTarget, lightView());
    Object.assign(liveDaylight, light.daylight);
    Object.assign(daylightTarget, liveDaylight);
  };

  const growSkyline = (): void => {
    void Promise.all([
      import("@/lib/skyline"),
      import("@/lib/skyline-gl"),
    ]).then(([{ buildSkyline }, { createSkylineGl }]) => {
      if (gone) return;
      const city = buildSkyline();
      skyline = city;
      landmarkData = landmarkUniforms(city.landmarks);
      skylineGl = createSkylineGl(gl, city, () => {
        if (rafId) markActive();
        else drawStill();
      });
    });
  };

  const moveScene = (seconds: number): void => {
    let moving = easeLook(look, rafId ? lookTarget(pointerAt) : look, seconds);
    if (skyline && pointerPx && rafId) {
      const box = canvas.getBoundingClientRect();
      hover = pickLandmark(
        skyline.landmarks,
        cameraFor(box.width, box.height),
        look,
        pointerPx,
        box.width,
        box.height
      );
    } else hover = undefined;
    if (rafId) {
      if (easeLean(landmarkData, hover, seconds)) moving = true;
      wheel =
        (wheel + (seconds * Math.PI * 2 * wheelSpeed) / wheelTurnSeconds) %
        (Math.PI * 2);
      worldPuffs = agePuffs(worldPuffs, seconds);
      if (worldPuffs.length > 0) moving = true;
    }
    if (moving) markActive();
  };

  const homeUniforms = (): void => {
    if (!light) return;
    const box = canvas.getBoundingClientRect();
    const camera = cameraFor(box.width, box.height);
    const shift = (shiftMs / 1000) % windWrap;
    uniforms.set("u_cam", camera.focal, camera.horizon, camera.eye);
    uniforms.set("u_look", look[0], look[1]);
    uniforms.set("u_pointer", look[0] * lookShare, look[1] * lookShare);
    uniforms.set("u_sun", ...light.shownSun, Math.asin(light.trueSun[1]));
    uniforms.set("u_sunCol", ...light.sunColor);
    uniforms.set("u_amb", ...light.ambient);
    uniforms.set("u_sunDisk", ...light.sunDisk);
    uniforms.set("u_moon", ...light.moon);
    uniforms.set("u_moon2", ...light.moonShade);
    uniforms.set("u_moon3", ...light.moonDisk);
    uniforms.set("u_moonCol", ...light.moonColor);
    uniforms.set(
      "u_wind",
      windGain[0] * shift,
      windGain[1] * shift,
      windGain[2] * shift,
      windGain[3] * shift
    );
    uniforms.set(
      "u_ground",
      0.85 * groundShare(weather.rain),
      groundShare(weather.snow)
    );
    uniforms.array("u_wpuff", puffUniforms(worldPuffs));
    uniforms.array("u_txt", textRects);
  };

  const drawSkyline = (): void => {
    if (!skylineGl || !light) return;
    const box = canvas.getBoundingClientRect();
    const camera = cameraFor(box.width, box.height);
    skylineGl.draw(
      {
        ambient: light.ambient,
        aspect: canvas.width / Math.max(1, canvas.height),
        camera: [camera.focal, camera.horizon, camera.eye],
        look,
        pointSize: Math.max(3, pointSize * scale),
        sun: light.trueSun,
        sunColor: light.sunColor,
        text: textRects,
        time: (clock.tick(performance.now()) / 1000) % timeWrap,
        under: light.under,
        view: canvas.height,
        weather: {
          horizon: light.skyHorizon,
          nightOn: light.nightOn,
          ramp: light.ramp,
          rim: light.shownSun,
          snow: groundShare(weather.snow),
          visibility: light.visibility,
          wet: 0.85 * groundShare(weather.rain),
          zenith: light.skyZenith,
        },
        wheel,
      },
      landmarkData
    );
  };

  const restoreSky = (): void => {
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, triangle);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  };

  const frame = (now: number, dt = frameDt): void => {
    const current = currentLevel();
    if (!current) return;
    if (home) restoreSky();
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
    trackCorner();
    uniforms.set("u_clouds", current.clouds ? 1 : 0);
    uniforms.set("u_cloudTime", (cloudMs / 1000) % timeWrap);
    uniforms.set("u_cloudShift", (shiftMs / 1000) % timeWrap);
    if (clockLive && now - daylightAt >= daylightEveryMs) {
      refreshLight();
      daylightAt = now;
      if (!daylightEasing) Object.assign(daylight, liveDaylight);
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
    if (home) {
      moveScene(rafId ? Math.min(dt, 100) / 1000 : 0);
      homeUniforms();
    }
    drawInk(now);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (home) drawSkyline();
  };

  const drawStill = (): void => {
    clock.pause();
    frame(performance.now());
  };

  const calmClouds = (): void => {
    gust.energy = 0;
    gust.inside = false;
    puffs.length = 0;
    worldPuffs = [];
    lastPuff = undefined;
    hover = undefined;
    settleLean(landmarkData);
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

  const stirClouds = (
    clientX: number,
    clientY: number,
    share: number
  ): void => {
    if (!rafId || !currentLevel()?.clouds) return;
    const [x, y] = toSky(clientX, clientY);
    const bottom = y + canvas.height / 2 / viewPixels();
    const inside = bottom < cloudZone;
    if (bottom < (home ? homePuffZone : puffZone))
      addPuff(x, bottom, clientX, clientY);
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
    if (home) {
      const box = canvas.getBoundingClientRect();
      const top = document.elementFromPoint(event.clientX, event.clientY);
      pointerAt = [
        (event.clientX / window.innerWidth) * 2 - 1,
        (event.clientY / window.innerHeight) * 2 - 1,
      ];
      pointerPx =
        top === null || top.matches(openTargets)
          ? [event.clientX - box.left, event.clientY - box.top]
          : undefined;
      return;
    }
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
    refreshLight();
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
    pointerAt = undefined;
    pointerPx = undefined;
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
      !document.documentElement.hasAttribute(motionPausedAttribute);
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
    if (anchored) {
      if (scriptDrift && !driftFrame)
        driftFrame = globalThis.requestAnimationFrame(placeDrift);
      if (!rafId && !holding) wakeProbe(scrollQuietMs);
      return;
    }
    if (!rafId) wakeProbe(scrollQuietMs);
  };
  const onShift = (event: TransitionEvent): void => {
    if (!rafId && event.target === event.currentTarget) drawStill();
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
    stop();
    setState("paused");
  };
  resize();
  launch(0);
  refreshWeather();
  frame(performance.now());
  sync();
  const cancelSkyline = skylineWanted ? whenIdle(growSkyline) : undefined;
  const settleTimer = home
    ? globalThis.setTimeout(() => {
        refreshLight();
        if (!rafId) drawStill();
      }, settleMs)
    : undefined;
  const weatherTimer = globalThis.setInterval(refreshWeather, weatherEveryMs);

  const sizeWatch = new ResizeObserver(onResize);
  sizeWatch.observe(canvas);
  const card = anchored ? null : document.querySelector("[data-card]");
  if (card) sizeWatch.observe(card);
  const holdWatch = anchored ? new IntersectionObserver(onHold) : undefined;
  const sentinel = anchored
    ? document.querySelector("[data-sky-sentinel]")
    : null;
  if (sentinel) holdWatch?.observe(sentinel);
  const onDriftChange = (): void => {
    if (scriptDrift) placeDrift();
  };
  if (scriptDrift) {
    placeDrift();
    globalThis.addEventListener(sceneHoldEvent, onDriftChange);
    reduceMotion.addEventListener("change", onDriftChange);
  }
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
    gone = true;
    stop();
    cancelSkyline?.();
    globalThis.clearTimeout(settleTimer);
    skylineGl?.dispose();
    weatherStop.abort();
    globalThis.clearInterval(weatherTimer);
    main?.removeEventListener("transitionend", onShift);
    if (resizeTimer !== undefined) globalThis.clearTimeout(resizeTimer);
    if (probeTimer !== undefined) globalThis.clearTimeout(probeTimer);
    if (readTimer !== undefined) globalThis.clearTimeout(readTimer);
    sizeWatch.disconnect();
    holdWatch?.disconnect();
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
    document.removeEventListener("visibilitychange", sync);
    reduceMotion.removeEventListener("change", sync);
  };
};

export const SpaceBackground = ({
  mode = "home",
}: SpaceBackgroundProps): ReactElement => {
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
    const gl = canvas.getContext(
      "webgl",
      mode === "blog" ? contextOptions : homeContextOptions
    );
    const still = gl ? isSoftwareRenderer(gl) : false;
    const vertex = gl ? createShader(gl, gl.VERTEX_SHADER, VERTEX) : undefined;
    const fragment = gl
      ? createShader(
          gl,
          gl.FRAGMENT_SHADER,
          mode === "blog" ? longRaysShader : HOME
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
      stopSky = startSky(
        gl,
        program,
        canvas,
        reduceMotion,
        still,
        setState,
        mode
      );
    });
    return () => {
      cancelWait();
      stopSky?.();
      release();
    };
  }, [mode]);

  const sky = (
    <canvas
      aria-hidden="true"
      data-space=""
      data-space-state="init"
      ref={ref}
    />
  );
  if (mode === "blog")
    return (
      <>
        <div aria-hidden="true" data-blog-sky="">
          {sky}
          <div data-sky-fade="" />
        </div>
        <div aria-hidden="true" data-sky-sentinel="" />
      </>
    );
  return sky;
};
