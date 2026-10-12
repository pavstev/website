"use client";

import { type ReactElement, useEffect, useRef } from "react";

import { createFrameClock } from "@/lib/frame-clock";
import { createFramePacer } from "@/lib/frame-pacer";
import { finePointerQuery, reducedMotionQuery } from "@/lib/media";
import { isSceneHeld, sceneHoldEvent } from "@/lib/scene-hold";
import { isSoftwareRenderer } from "@/lib/webgl";

const VERTEX = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_res;
uniform float u_view;
uniform float u_labPx;
uniform float u_time;
uniform vec2 u_pointer;
uniform vec3 u_portrait;
uniform vec3 u_ripple;
uniform vec4 u_meteor;
uniform float u_clouds;

const float PI = 3.14159265;
const float TAU = 6.2831853;
const float speed = 1.82;
const float brightness = 0.7;
const float hueShift = -0.2618;
const float centerDim = 0.39;
const float starAmount = 0.78;
const float twinkle = 0.25;
const float coronaSize = 0.48;
const float coronaBright = 1.06;
const float streamers = 1.68;
const float streamDetail = 5.1;
const float fineRays = 1.27;
const float equator = 0.97;
const float lowerFade = 0.7;
const float drift = 0.02;
const float flares = 0.52;
const float flareSize = 0.123;
const float flareHue = -0.4363;
const float rim = 0.5;
const float flash = 0.44;
const float flashAngle = 2.3562;
const float flashPeriod = 13.96;
const float horizonGlow = 1.0;
const float glowFalloff = 5.1;
const float skyTop = 0.5;
const float cloudHeight = 0.33;
const float cloudCover = 0.47;
const float cloudSoft = 0.053;
const float cloudScale = 3.13;
const float cloudDrift = 0.6;
const float underglow = 1.52;
const float silver = 0.47;
const float cloudDark = 0.74;
const float cloudOpacity = 0.69;
const float cloudReach = 0.52;
const float coronaReach = 14.0;
const float coronaFade = 9.0;
const float coronaTaperStart = 3.0;
const float coronaTaperEnd = 6.0;
const float meteorTail = 0.35;
const float meteorTravel = 0.75;
const float meteorWidth = 0.0028;
const float rippleStrength = 0.44;
const float rippleSharpness = 10.0;
const float rippleLife = 1.6;
const vec3 glowColor = vec3(1.0, 0.5, 0.24);

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

float fbm3(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p = m * p + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

float fbmTaper(vec2 p, float keep) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    if (i >= 3) {
      if (keep <= 0.0) break;
      a *= keep;
    }
    v += a * noise(p);
    p = m * p + vec2(1.7, 9.2);
    a *= i >= 3 ? 0.5 / keep : 0.5;
  }
  return v;
}

vec3 hueRotate(vec3 c, float a) {
  vec3 k = vec3(0.57735);
  float ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
}

vec3 starField(vec2 p, float scale, float keep, float t) {
  keep = 1.0 - (1.0 - keep) * starAmount;
  vec2 g = p * scale;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float r = hash(id);
  if (r < keep) return vec3(0.0);
  vec2 o = vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5;
  float d = length(f - o * 0.6) * u_view / scale * u_labPx;
  float b = pow(hash(id + 1.3), 6.0) * 2.0 + 0.03;
  float tw = 1.0 - twinkle + twinkle * sin(t * (0.6 + r * 2.0) + r * 40.0);
  vec3 tint = mix(vec3(0.68, 0.78, 1.0), vec3(1.0, 0.86, 0.66), hash(id + 5.5));
  float core = smoothstep(max(1.4, u_labPx * 1.1), 0.0, d);
  return tint * b * tw * (core + exp(-d) * b * 0.18);
}

vec3 stars(vec2 p, float t) {
  return starField(p, 30.0, 0.8, t) + starField(p + 3.7, 70.0, 0.88, t) * 0.75 + starField(p + 9.1, 150.0, 0.93, t) * 0.5;
}

vec3 cloudLayer(vec3 col, vec2 p, float yb, float near, float t) {
  float top = cloudHeight * mix(1.0, 0.62, near);
  if (yb - top * 0.35 > top + cloudSoft) return col;
  float sc = cloudScale * (1.0 + near * 0.6);
  float tt = t * 0.01 * cloudDrift * (1.0 + near * 0.8);
  vec2 q = vec2(p.x * sc + tt + near * 13.7, yb * sc * 1.6 + near * 5.1);
  vec2 w = vec2(fbm3(q * 0.7 + tt * 0.3), fbm3(q * 0.7 + 3.1 - tt * 0.2));
  float n = fbm(q + w * 1.2);
  float y = yb + (n - 0.5) * top * 0.7;
  float hm = smoothstep(top + cloudSoft, top - cloudSoft, y);
  if (hm <= 0.0) return col;
  float dens = hm * smoothstep(1.0 - cloudCover - 0.12, 1.0 - cloudCover + 0.14, n + (1.0 - yb / max(top, 0.001)) * 0.35);
  dens = clamp(dens, 0.0, 1.0);
  if (dens <= 0.0) return col;
  float billow = fbm3(q * 2.3 + w * 2.0);
  float edge = smoothstep(0.0, 0.35, dens) * (1.0 - smoothstep(0.35, 0.9, dens));
  float under = exp(-yb * glowFalloff * 0.8);
  vec3 body = mix(vec3(0.08, 0.085, 0.12), vec3(0.015, 0.017, 0.03), cloudDark) * (1.0 - near * 0.3) * (0.65 + 0.7 * billow);
  vec3 lit = glowColor * under * underglow * 0.9 * horizonGlow * (0.5 + 0.9 * (1.0 - billow));
  vec3 cc = body + lit * (1.0 - dens * 0.4) + vec3(0.75, 0.8, 1.0) * edge * silver * 0.22;
  return mix(col, cc, dens * cloudOpacity);
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  float yb = fc.y / u_view;
  float yt = (u_res.y - fc.y) / u_view;
  vec2 p = (fc - 0.5 * u_res) / u_view;
  vec2 ps = p + u_pointer;
  float t = u_time * speed;

  vec3 col = vec3(0.02, 0.025, 0.05) + vec3(0.03, 0.05, 0.13) * (1.0 - clamp(yb, 0.0, 1.0)) * skyTop * 2.0;
  col += stars(ps, t) * 0.55;
  col += (glowColor * 0.3 * exp(-yb * glowFalloff) + vec3(0.55, 0.32, 0.6) * 0.1 * exp(-yb * glowFalloff * 0.39)) * horizonGlow * 2.0;

  if (u_portrait.z > 0.5) {
    float r0 = u_portrait.z;
    vec2 d = (fc - u_portrait.xy) / r0;
    float r = length(d);
    if (r < coronaReach) {
      vec2 dir = d / max(r, 0.0001);
      float rr = max(1.0 + (r - 1.0) / coronaSize, 1.0);
      float taper = smoothstep(coronaTaperEnd, coronaTaperStart, r);
      float str = pow(fbmTaper(dir * streamDetail + vec2(log(rr) * 0.3 - t * drift, t * drift * 0.5), taper), 2.0) * 2.2;
      float fine = fbmTaper(dir * 16.0 + vec2(log(rr) * 0.2, t * drift * 0.75), taper);
      float eq = (1.0 - equator * 0.69) + equator * abs(dir.x);
      float cor = (pow(1.0 / rr, 2.6) * 2.4 + pow(1.0 / rr, 1.25) * 0.32 * (str * 1.8 * streamers + fine * fineRays) * eq) * smoothstep(0.995, 1.01, r);
      cor *= mix(1.0 - lowerFade, 1.0, smoothstep(-2.6, 0.2, d.y));
      vec3 inner = mix(vec3(1.0, 0.97, 0.92), vec3(1.0, 0.82, 0.52), 0.5);
      vec3 outer = mix(vec3(0.92, 0.92, 0.95), vec3(0.6, 0.74, 1.0), 0.5);
      col += mix(inner, outer, smoothstep(1.0, 3.2, rr)) * cor * 0.8 * coronaBright * smoothstep(coronaReach, coronaFade, r);
      if (r < 1.0 + flareSize + 0.05) {
        float pr = smoothstep(0.6, 0.8, fbm(dir * 9.0 + vec2(t * 0.03, 0.0))) * smoothstep(1.0 + flareSize, 1.0, r) * step(1.0, r);
        col += hueRotate(vec3(1.0, 0.32, 0.55), flareHue) * pr * 1.4 * flares;
      }
      col += hueRotate(vec3(1.0, 0.42, 0.62), flareHue) * exp(-abs(r - 1.0) * r0 * u_labPx * 0.45) * rim;
      float pulse = pow(0.5 + 0.5 * sin(t * TAU / flashPeriod), 10.0) * flash;
      if (pulse > 0.002) {
        vec2 bq = (d - vec2(cos(flashAngle), sin(flashAngle)) * 1.01) * r0 * u_labPx;
        float bl = length(bq);
        float bead = exp(-bl * 0.22) * 1.6 + exp(-abs(bq.y) * 0.7) * exp(-abs(bq.x) * 0.02) * 0.5 + exp(-abs(bq.x) * 0.7) * exp(-abs(bq.y) * 0.03) * 0.3;
        col += vec3(1.0, 0.96, 0.88) * bead * pulse;
      }
      col *= smoothstep(0.97, 1.0, r) * 0.97 + 0.03;
    }
  }

  if (u_meteor.w < 1.0) {
    vec2 md = vec2(cos(u_meteor.z), sin(u_meteor.z));
    vec2 rel = ps - (u_meteor.xy + md * u_meteor.w * meteorTravel);
    float behind = dot(rel, -md);
    float across = dot(rel, vec2(-md.y, md.x)) / meteorWidth;
    float trail = smoothstep(meteorTail, 0.0, behind) * step(-0.003, behind) * exp(-across * across);
    float head = exp(-dot(rel, rel) / 0.00005);
    col += vec3(0.92, 0.96, 1.0) * (trail * 0.9 + head * 1.4) * sin(PI * u_meteor.w);
  }

  if (u_clouds > 0.5 && yb < cloudReach) {
    col = cloudLayer(col, ps * 0.6 + p * 0.4, yb, 0.0, t);
    col = cloudLayer(col, p, yb, 1.0, t);
  }

  if (u_ripple.z < rippleLife) {
    float rd = length(p - u_ripple.xy);
    float rx = (rd - u_ripple.z * 0.55) * rippleSharpness;
    col += vec3(0.62, 0.73, 1.0) * exp(-rx * rx) * max(0.0, 1.0 - u_ripple.z / rippleLife) * 0.18 * rippleStrength;
  }

  float vx = fc.x / u_res.x - 0.5;
  float vy = max(max(0.5 - yt, 0.5 - yb), 0.0);
  float vignette = smoothstep(0.1, 0.9, length(vec2(vx, vy)) * 1.3);
  col *= mix(1.0 - centerDim, 1.0, vignette);
  col = max(hueRotate(col * brightness, hueShift), 0.0);
  col = 1.0 - exp(-col * 1.15);
  col += (fract(52.9829189 * fract(dot(fc, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;

interface QualityLevel {
  clouds: boolean;
  scale: number;
}

type SpaceState = "fallback" | "paused" | "running" | "static";

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
  const highPrecision =
    (gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)
      ?.precision ?? 0) > 0;
  const timeWrap = highPrecision ? timeWrapHighSeconds : timeWrapLowSeconds;

  let level = 0;
  let scale = 1;
  let rafId = 0;
  let frozen = false;
  let portraitNode: Element | null = null;
  const pointer = { x: 0, y: 0 };
  const pointerTarget = { x: 0, y: 0 };
  const ripple = { age: rippleLife, x: 0, y: 0 };
  const meteor = { angle: 0, at: 0, x: 0, y: 0 };
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
    const entry = LEVELS[level] ?? LEVELS[0];
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
    const current = LEVELS[level] ?? LEVELS[0];
    if (!current) return;
    const skyMs = clock.tick(now);
    const follow = 1 - Math.exp((-followRate * dt) / 1000);
    pointer.x += (pointerTarget.x - pointer.x) * follow;
    pointer.y += (pointerTarget.y - pointer.y) * follow;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uView, viewPixels());
    gl.uniform1f(uLabPx, labPixelsPerCss / scale);
    gl.uniform1f(uTime, (skyMs / 1000) % timeWrap);
    gl.uniform2f(uPointer, pointer.x, pointer.y);
    trackPortrait();
    if (ripple.age < rippleLife) ripple.age += (dt / 1000) * rippleSpeed;
    gl.uniform3f(uRipple, ripple.x, ripple.y, ripple.age);
    gl.uniform1f(uClouds, current.clouds ? 1 : 0);
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

  const onPointer = (event: PointerEvent): void => {
    markActive();
    if (reduceMotion.matches || !hoverPointer.matches || isSceneHeld()) return;
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
