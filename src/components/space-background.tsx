"use client";

import { type ReactElement, useEffect, useRef } from "react";

import type { StarGl } from "@/lib/star-gl";

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
import { equatorialToWorld, type Mat3, worldToGalactic } from "@/lib/sky-frame";
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
  viennaLatitude,
  viennaLongitude,
} from "@/lib/sky-light";
import { blogLook, earthClouds, type SkyMode } from "@/lib/sky-preset";
import { createSkyProbe, type ProbeBox } from "@/lib/sky-probe";
import { cornerCorona, cornerMeteor, longRaysShader } from "@/lib/sky-rays";
import {
  addWorldPuff,
  agePuffs,
  easeLook,
  type Look,
  lookTarget,
  orbitBoost,
  orbitStep,
  puffUniforms,
  windGain,
  type WorldPuff,
  worldPuff,
} from "@/lib/sky-scene";
import {
  homeSkyFragmentShader as HOME,
  skyVertexShader as VERTEX,
} from "@/lib/sky-shader";
import {
  type Aim,
  aimHolds,
  aimYaw,
  type Basis,
  cameraBasis,
  frameAim,
  skyCamera,
  type SkyCamera,
  skyRay,
  type ViewSize,
} from "@/lib/sky-view";
import { createUniformSink } from "@/lib/uniform-sink";
import { isSoftwareRenderer } from "@/lib/webgl";

interface HomeFrame {
  basis: Basis;
  camera: SkyCamera;
  puffs: Float32Array;
  wind: [number, number, number, number];
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
const meteorGapMs: [number, number] = [2200, 8000];
const burstEnergy = 0.7;
const burstGapMs = 2600;
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
const easeSeconds = 3;
const windWrapHighSeconds = 7200;
const starIdleMs = 2000;
const settleMs = 1500;
const homePuffZone = 0.95;
const lookShare = 0.6;
const lightEveryMs = 1000;
const panRate = 1.6;
const panSettled = 1e-4;
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

const wrapAngle = (angle: number): number =>
  angle - 2 * Math.PI * Math.floor((angle + Math.PI) / (2 * Math.PI));

const identity: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

const whenIdle = (task: () => void): (() => void) => {
  if ("requestIdleCallback" in globalThis) {
    const handle = globalThis.requestIdleCallback(task, {
      timeout: starIdleMs,
    });
    return () => {
      globalThis.cancelIdleCallback(handle);
    };
  }
  const timer = globalThis.setTimeout(task, starIdleMs / 4);
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
  const meteor2 = { angle: 0, at: 0, x: 0, y: 0 };
  const orbit: [number, number] = [0, 0];
  let burstAt = -Infinity;
  const flightMs = anchored ? postMeteorMs : meteorMs;
  const gust = { dir: -1, energy: 0, inside: false, x: 0, y: 0 };
  let cloudMs = 0;
  let shiftMs = 0;
  const pinned = instantOverride(globalThis.location.search);
  const crawler = pinned === undefined && isCrawler(navigator.userAgent);
  const fixedLook = anchored ? blogLook() : undefined;
  const calm = anchored && (crawler || prefersLightLoad());
  if (calm && drift) drift.dataset["skyStill"] = "";
  const clockLive = !crawler && !anchored;
  const instant = (): number =>
    crawler ? crawlerInstant : (pinned ?? Date.now());
  const clouds = fixedLook?.clouds ?? earthClouds;
  const cardNode = home ? document.querySelector("[data-card]") : null;
  const widthNode = home ? document.querySelector("[data-card] .bio") : null;
  const cardRange = document.createRange();
  const lightView = (): ViewSize => {
    const box = canvas.getBoundingClientRect();
    const view: ViewSize = { height: box.height, width: box.width };
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
  let light: SkyLight | undefined = home ? skyLight(instant()) : undefined;
  let aim: Aim | undefined = home
    ? frameAim(instant(), viennaLatitude, viennaLongitude)
    : undefined;
  let yaw = aim ? aimYaw(aim, lightView()) : 0;
  let shownYaw = yaw;
  let equatorial: Mat3 = home
    ? equatorialToWorld(instant(), viennaLatitude, viennaLongitude)
    : identity;
  let galactic: Mat3 = home
    ? worldToGalactic(instant(), viennaLatitude, viennaLongitude)
    : identity;
  let lightAt = performance.now();
  const liveDaylight: SkyPhase = light
    ? { ...light.daylight }
    : { ...(crawler ? nightPhase : (fixedLook?.daylight ?? nightPhase)) };
  let daylightAt = performance.now();
  const textRects = new Float32Array(targets.length * 4);
  const look: Look = [0, 0, 0];
  let pointerAt: [number, number] | undefined;
  let worldPuffs: WorldPuff[] = [];
  const homeFrame: HomeFrame = {
    basis: cameraBasis(0, 0),
    camera: skyCamera(1, 1),
    puffs: puffUniforms([]),
    wind: [0, 0, 0, 0],
  };
  let starGl: StarGl | undefined;
  let refreshPlanets: (() => void) | undefined;
  let gone = false;
  const starsWanted = home && !prefersLightLoad();
  const daylightTarget: SkyPhase = { ...liveDaylight };
  const daylight: SkyPhase = { ...daylightTarget };
  const meteorShown = !anchored || !crawler;
  let holding = false;
  let daylightEasing = false;
  let driftFrame = 0;
  const scriptDrift =
    anchored &&
    drift !== null &&
    !CSS.supports("animation-timeline", "scroll()");
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

  const launch = (slot: typeof meteor, now: number, wait = nextGap()): void => {
    if (anchored) {
      const view = viewPixels();
      const halfWidth = canvas.width / view / 2;
      Object.assign(slot, cornerMeteor, {
        at: now + postMeteorGapMs,
        x: Math.min(cornerMeteor.x, halfWidth - postMeteorRoom),
        y: canvas.height / view / 2 - (0.5 - cornerMeteor.y),
      });
      return;
    }
    slot.at = now + wait;
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const [, centerY] = toSky(window.innerWidth / 2, window.innerHeight / 2);
    const side = Math.random() < 0.5 ? -1 : 1;
    const tilt = 0.3 + Math.random() * 0.45;
    slot.x = side * (0.1 + Math.random() * 0.4) * aspect;
    slot.y = centerY + 0.18 + Math.random() * 0.3;
    slot.angle = side < 0 ? -tilt : Math.PI + tilt;
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
    if (home) {
      const box = canvas.getBoundingClientRect();
      homeFrame.camera = skyCamera(box.width, box.height);
    }
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
      const held = lifts[slot] ?? 0;
      if (held > 0) nodes.paint?.style.setProperty("--lift", held.toFixed(2));
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
      const { camera } = homeFrame;
      const ray = skyRay(
        clientX - box.left,
        clientY - box.top,
        currentBasis(),
        camera,
        box.width,
        box.height
      );
      const puff = worldPuff(ray, camera.eye, [
        homeFrame.wind[0],
        homeFrame.wind[1],
      ]);
      if (puff) worldPuffs = addWorldPuff(worldPuffs, puff);
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

  const moveSky = (): void => {
    if (!home) return;
    const now = instant();
    light = skyLight(now);
    equatorial = equatorialToWorld(now, viennaLatitude, viennaLongitude);
    galactic = worldToGalactic(now, viennaLatitude, viennaLongitude);
  };

  const refreshLight = (reaim = false): void => {
    if (!home) return;
    moveSky();
    if (light) {
      Object.assign(liveDaylight, light.daylight);
      Object.assign(daylightTarget, liveDaylight);
    }
    refreshPlanets?.();
    const next = frameAim(instant(), viennaLatitude, viennaLongitude);
    const view = lightView();
    if (reaim || next.kind !== aim?.kind || !aimHolds(yaw, next, view))
      yaw = aimYaw(next, view);
    aim = next;
    if (reaim || !rafId) shownYaw = yaw;
  };

  const growStars = (): void => {
    void Promise.all([
      import("@/lib/star-gl"),
      import("@/lib/sky-stars"),
      import("@/lib/sky-planets"),
    ]).then(([{ createStarGl }, { decodeStars }, { planetsAt }]) => {
      if (gone) return;
      starGl = createStarGl(gl, decodeStars(), () => {
        if (rafId) markActive();
        else drawStill();
      });
      refreshPlanets = (): void => starGl?.setPlanets(planetsAt(instant()));
      refreshPlanets();
    });
  };

  const moveScene = (seconds: number): void => {
    let moving = easeLook(look, rafId ? lookTarget(pointerAt) : look, seconds);
    if (rafId) {
      const gap = wrapAngle(yaw - shownYaw);
      if (Math.abs(gap) > panSettled) {
        shownYaw = wrapAngle(
          shownYaw + gap * (1 - Math.exp(-seconds * panRate))
        );
        moving = true;
      } else shownYaw = yaw;
      worldPuffs = agePuffs(worldPuffs, seconds);
      if (worldPuffs.length > 0) moving = true;
    } else shownYaw = yaw;
    if (moving) markActive();
  };

  const currentBasis = (): ReturnType<typeof cameraBasis> =>
    cameraBasis(shownYaw + look[0], look[1], look[2]);

  const homeUniforms = (): void => {
    if (!light) return;
    const { camera } = homeFrame;
    const shift = (shiftMs / 1000) % windWrap;
    homeFrame.basis = currentBasis();
    homeFrame.puffs = puffUniforms(worldPuffs);
    homeFrame.wind = [
      windGain[0] * shift,
      windGain[1] * shift,
      windGain[2] * shift,
      windGain[3] * shift,
    ];
    uniforms.set("u_cam", camera.top, camera.horizon, camera.eye);
    uniforms.matrix("u_basis", homeFrame.basis);
    uniforms.matrix("u_gal", galactic);
    uniforms.set("u_pointer", look[0] * lookShare, look[1] * lookShare);
    uniforms.set("u_sun", ...light.sun);
    uniforms.set("u_sunCol", ...light.sunColor);
    uniforms.set("u_sunDisk", ...light.sunDisk);
    uniforms.set("u_moon", ...light.moon);
    uniforms.set("u_moon2", ...light.moonShade);
    uniforms.set("u_moon3", ...light.moonDisk);
    uniforms.set("u_moonCol", ...light.moonColor);
    uniforms.set("u_wind", ...homeFrame.wind);
    uniforms.set("u_orbit", orbit[0], orbit[1]);
    uniforms.array("u_wpuff", homeFrame.puffs);
    uniforms.array("u_txt", textRects);
  };

  const drawStars = (skyMs: number): void => {
    if (!starGl || !light) return;
    const { camera } = homeFrame;
    starGl.draw({
      basis: homeFrame.basis,
      camera: [camera.top, camera.horizon, camera.eye],
      day: daylight.day,
      equatorial,
      height: canvas.height,
      moon: light.moon,
      moonSky: Math.min(1, light.moonColor[0] * 25),
      pixel: scale,
      sun: light.sun,
      text: textRects,
      time: (skyMs / 1000) % timeWrap,
      width: canvas.width,
    });
  };

  const restoreSky = (): void => {
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, triangle);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  };

  const fly = (slot: typeof meteor, name: string, skyMs: number): void => {
    const flight = rafId && meteorShown ? (skyMs - slot.at) / flightMs : -1;
    if (flight >= 1) launch(slot, skyMs);
    if (flight >= 0 && flight < 1) markActive();
    uniforms.set(
      name,
      slot.x,
      slot.y,
      slot.angle,
      flight >= 0 && flight < 1 ? flight : 2
    );
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
      const ease = 1 - Math.exp(-step / 1000 / easeSeconds);
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
      if (home && highPrecision)
        orbitStep(orbit, shownYaw, step / 1000, orbitBoost(gust.energy));
      shiftMs += step * (1 - boost * gust.dir);
      for (const puff of puffs) puff.age += step / 1000;
      if (gust.energy > gustActive) markActive();
    }
    if (anchored) {
      const puffing = uploadPuffs();
      if (rafId && puffing) markActive();
    }
    uniforms.set("u_res", canvas.width, canvas.height);
    uniforms.set("u_view", viewPixels());
    uniforms.set("u_labPx", labPixelsPerCss / scale);
    uniforms.set("u_time", (skyMs / 1000) % timeWrap);
    if (anchored) uniforms.set("u_pointer", pointer.x, pointer.y);
    trackCorner();
    uniforms.set("u_clouds", current.clouds ? 1 : 0);
    uniforms.set("u_cloudTime", (cloudMs / 1000) % timeWrap);
    uniforms.set("u_cloudShift", (shiftMs / 1000) % timeWrap);
    if (clockLive && now - daylightAt >= daylightEveryMs) {
      refreshLight();
      daylightAt = now;
      lightAt = now;
      if (!daylightEasing) Object.assign(daylight, liveDaylight);
    } else if (clockLive && rafId && now - lightAt >= lightEveryMs) {
      moveSky();
      lightAt = now;
    }
    uniforms.set("u_daylight", daylight.day, daylight.twilight, daylight.dusk);
    uniforms.set(
      "u_weather",
      clouds.cover,
      clouds.overcast,
      clouds.high,
      clouds.fog
    );
    fly(meteor, "u_meteor", skyMs);
    if (home) {
      if (rafId && gust.energy > burstEnergy && skyMs - burstAt > burstGapMs) {
        const idle = [meteor, meteor2].find((slot) => slot.at > skyMs);
        if (idle) {
          launch(idle, skyMs, 0);
          burstAt = skyMs;
        }
      }
      fly(meteor2, "u_meteor2", skyMs);
    }
    if (home) {
      moveScene(rafId ? Math.min(dt, 100) / 1000 : 0);
      homeUniforms();
    }
    drawInk(now);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (home) drawStars(skyMs);
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
  };

  const stop = (): void => {
    if (rafId) globalThis.cancelAnimationFrame(rafId);
    rafId = 0;
    pacer.reset();
    clock.pause();
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
    const inside = home || bottom < cloudZone;
    if (bottom < (home ? homePuffZone : puffZone))
      addPuff(x, bottom, clientX, clientY);
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
    if (home) {
      pointerAt = [
        (event.clientX / window.innerWidth) * 2 - 1,
        (event.clientY / window.innerHeight) * 2 - 1,
      ];
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
    refreshLight(true);
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
    stop();
    setState("paused");
  };
  resize();
  launch(meteor, 0);
  if (home) launch(meteor2, 0);
  frame(performance.now());
  sync();
  const cancelStars = starsWanted ? whenIdle(growStars) : undefined;
  const settleTimer = home
    ? globalThis.setTimeout(() => {
        refreshLight(true);
        if (!rafId) drawStill();
      }, settleMs)
    : undefined;

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
  document.addEventListener("visibilitychange", sync);
  reduceMotion.addEventListener("change", sync);
  return () => {
    gone = true;
    stop();
    cancelStars?.();
    globalThis.clearTimeout(settleTimer);
    starGl?.dispose();
    document.removeEventListener("transitionend", onShift);
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
    const gl = canvas.getContext("webgl", contextOptions);
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
