"use client";

import { type ReactElement, useEffect, useRef } from "react";

import { createFrameClock } from "@/lib/frame-clock";
import { createFramePacer } from "@/lib/frame-pacer";
import { finePointerQuery, reducedMotionQuery } from "@/lib/media";
import { isSceneHeld, sceneHoldEvent } from "@/lib/scene-hold";
import { skyPhase } from "@/lib/sky-clock";
import {
  skyFragmentShader as FRAGMENT,
  skyVertexShader as VERTEX,
} from "@/lib/sky-shader";
import { isSoftwareRenderer } from "@/lib/webgl";

interface QualityLevel {
  clouds: boolean;
  scale: number;
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
const rippleLife = 1.6;
const rippleSpeed = 2.25;
const resizeDelayMs = 150;
const meteorMs = 1450;
const meteorGapMs: [number, number] = [2000, 14_000];
const timeWrapHighSeconds = 86_400;
const timeWrapLowSeconds = 1024;
const portraitSelector = "[data-card] [data-portrait]";
const cloudZone = 0.5;
const daylightEveryMs = 30_000;
const stirHover = 0.35;
const stirGain = 2.4;
const stirDecay = 1.3;
const stirBoost = 3.5;
const windDecay = 2.2;
const windMax = 1.2;

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

const startSky = (
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  canvas: HTMLCanvasElement,
  reduceMotion: MediaQueryList,
  still: boolean,
  setState: (state: SpaceState) => void
): (() => void) => {
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

  const uRes = gl.getUniformLocation(program, "u_res");
  const uView = gl.getUniformLocation(program, "u_view");
  const uLabPx = gl.getUniformLocation(program, "u_labPx");
  const uTime = gl.getUniformLocation(program, "u_time");
  const uPointer = gl.getUniformLocation(program, "u_pointer");
  const uPortrait = gl.getUniformLocation(program, "u_portrait");
  const uRipple = gl.getUniformLocation(program, "u_ripple");
  const uMeteor = gl.getUniformLocation(program, "u_meteor");
  const uClouds = gl.getUniformLocation(program, "u_clouds");
  const uCloudTime = gl.getUniformLocation(program, "u_cloudTime");
  const uStir = gl.getUniformLocation(program, "u_stir");
  const uWind = gl.getUniformLocation(program, "u_wind");
  const uDaylight = gl.getUniformLocation(program, "u_daylight");
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
  const pointer = { x: 0, y: 0 };
  const pointerTarget = { x: 0, y: 0 };
  const ripple = { age: rippleLife, x: 0, y: 0 };
  const meteor = { angle: 0, at: 0, x: 0, y: 0 };
  const stir = { at: 0, energy: 0, inside: false, vx: 0, vy: 0, x: 0, y: 0 };
  let cloudMs = 0;
  let daylight = skyPhase(new Date());
  let daylightAt = performance.now();
  const clock = createFrameClock();
  const hoverPointer = globalThis.matchMedia(finePointerQuery);
  let resizeTimer: ReturnType<typeof globalThis.setTimeout> | undefined;

  const viewPixels = (): number => Math.max(1, window.innerHeight * scale);

  const toSky = (clientX: number, clientY: number): [number, number] => {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * scale;
    const y = (rect.bottom - clientY) * scale;
    const view = viewPixels();
    return [(x - canvas.width / 2) / view, (y - canvas.height / 2) / view];
  };

  const launch = (now: number): void => {
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

  const trackPortrait = (): void => {
    if (!portraitNode?.isConnected)
      portraitNode = document.querySelector(portraitSelector);
    if (!portraitNode) {
      gl.uniform3f(uPortrait, 0, 0, 0);
      return;
    }
    const sky = canvas.getBoundingClientRect();
    const face = portraitNode.getBoundingClientRect();
    gl.uniform3f(
      uPortrait,
      (face.left + face.width / 2 - sky.left) * scale,
      (sky.bottom - face.top - face.height / 2) * scale,
      (face.width / 2) * scale
    );
  };

  const frame = (now: number, dt = frameDt): void => {
    const current = currentLevel();
    if (!current) return;
    const skyMs = clock.tick(now);
    const follow = 1 - Math.exp((-followRate * dt) / 1000);
    pointer.x += (pointerTarget.x - pointer.x) * follow;
    pointer.y += (pointerTarget.y - pointer.y) * follow;
    const settle = Math.exp((-stirDecay * dt) / 1000);
    stir.energy =
      stir.energy * settle + (stir.inside ? (1 - settle) * stirHover : 0);
    const calm = Math.exp((-windDecay * dt) / 1000);
    stir.vx *= calm;
    stir.vy *= calm;
    if (rafId) cloudMs += Math.min(dt, 100) * (1 + stir.energy * stirBoost);
    if (stir.energy > 0.05) markActive();
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uView, viewPixels());
    gl.uniform1f(uLabPx, labPixelsPerCss / scale);
    gl.uniform1f(uTime, (skyMs / 1000) % timeWrap);
    gl.uniform2f(uPointer, pointer.x, pointer.y);
    trackPortrait();
    if (ripple.age < rippleLife) ripple.age += (dt / 1000) * rippleSpeed;
    gl.uniform3f(uRipple, ripple.x, ripple.y, ripple.age);
    gl.uniform1f(uClouds, current.clouds ? 1 : 0);
    gl.uniform1f(uCloudTime, (cloudMs / 1000) % timeWrap);
    gl.uniform3f(uStir, stir.x, stir.y, Math.min(stir.energy, 1));
    gl.uniform2f(uWind, stir.vx, stir.vy);
    if (now - daylightAt >= daylightEveryMs) {
      daylight = skyPhase(new Date());
      daylightAt = now;
    }
    gl.uniform3f(uDaylight, daylight.day, daylight.twilight, daylight.dusk);
    const flight = rafId ? (skyMs - meteor.at) / meteorMs : -1;
    if (flight >= 1) launch(skyMs);
    if (flight >= 0 && flight < 1) markActive();
    gl.uniform4f(
      uMeteor,
      meteor.x,
      meteor.y,
      meteor.angle,
      flight >= 0 && flight < 1 ? flight : 2
    );
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const drawStill = (): void => {
    clock.pause();
    frame(performance.now());
  };

  const calmClouds = (): void => {
    stir.energy = 0;
    stir.inside = false;
    stir.vx = 0;
    stir.vy = 0;
  };

  const stop = (): void => {
    if (rafId) globalThis.cancelAnimationFrame(rafId);
    rafId = 0;
    pacer.reset();
    clock.pause();
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
    if (still || reduceMotion.matches) {
      frame(performance.now());
      setState("static");
      return;
    }
    if (document.hidden || isSceneHeld()) {
      ripple.age = rippleLife;
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

  const stirClouds = (event: PointerEvent): void => {
    const [x, y] = toSky(event.clientX, event.clientY);
    const bottom = y + canvas.height / 2 / viewPixels();
    const seconds = Math.max((event.timeStamp - stir.at) / 1000, 1 / 240);
    const dx = stir.inside ? x - stir.x : 0;
    const dy = stir.inside ? y - stir.y : 0;
    stir.at = event.timeStamp;
    stir.x = x;
    stir.y = y;
    stir.inside = bottom < cloudZone;
    if (!stir.inside) return;
    const step = Math.min(Math.hypot(dx, dy), 0.2);
    stir.energy = Math.min(1, stir.energy + step * stirGain);
    const blend = Math.min(1, seconds * 12);
    stir.vx += (dx / seconds - stir.vx) * blend;
    stir.vy += (dy / seconds - stir.vy) * blend;
    const speed = Math.hypot(stir.vx, stir.vy);
    if (speed <= windMax) return;
    stir.vx *= windMax / speed;
    stir.vy *= windMax / speed;
  };

  const onPointer = (event: PointerEvent): void => {
    markActive();
    if (reduceMotion.matches || !hoverPointer.matches || isSceneHeld()) return;
    stirClouds(event);
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    pointerTarget.x =
      (event.clientX / window.innerWidth - 0.5) * parallaxReach * aspect;
    pointerTarget.y =
      (0.5 - event.clientY / window.innerHeight) * parallaxReach;
  };
  const onDown = (event: PointerEvent): void => {
    if (reduceMotion.matches || isSceneHeld()) return;
    markActive();
    const [x, y] = toSky(event.clientX, event.clientY);
    ripple.x = x;
    ripple.y = y;
    ripple.age = 0;
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
    if (event.relatedTarget === null) stir.inside = false;
  };
  const onBlur = (): void => {
    stop();
    setState("paused");
  };

  resize();
  launch(0);
  frame(performance.now());
  sync();

  const sizeWatch = new ResizeObserver(onResize);
  sizeWatch.observe(canvas);
  const card = document.querySelector("[data-card]");
  if (card) sizeWatch.observe(card);
  window.addEventListener("resize", onResize);
  globalThis.addEventListener("pointermove", onPointer, { passive: true });
  globalThis.addEventListener("pointerdown", onDown, { passive: true });
  globalThis.addEventListener("pointerout", onLeave, { passive: true });
  window.addEventListener("blur", onBlur);
  window.addEventListener("focus", sync);
  globalThis.addEventListener(sceneHoldEvent, sync);
  document.addEventListener("visibilitychange", sync);
  reduceMotion.addEventListener("change", sync);
  return () => {
    stop();
    if (resizeTimer !== undefined) globalThis.clearTimeout(resizeTimer);
    sizeWatch.disconnect();
    window.removeEventListener("resize", onResize);
    globalThis.removeEventListener("pointermove", onPointer);
    globalThis.removeEventListener("pointerdown", onDown);
    globalThis.removeEventListener("pointerout", onLeave);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("focus", sync);
    globalThis.removeEventListener(sceneHoldEvent, sync);
    document.removeEventListener("visibilitychange", sync);
    reduceMotion.removeEventListener("change", sync);
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
    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: "low-power",
      stencil: false,
    });
    const still = gl ? isSoftwareRenderer(gl) : false;
    const vertex = gl ? createShader(gl, gl.VERTEX_SHADER, VERTEX) : undefined;
    const fragment = gl
      ? createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT)
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
    };
  }, []);

  return (
    <canvas
      aria-hidden="true"
      data-space=""
      data-space-state="init"
      ref={ref}
    />
  );
};
