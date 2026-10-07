"use client";

import { type ReactElement, useEffect, useRef } from "react";

import { createFramePacer, pacerIdleMs } from "@/lib/frame-pacer";
import { finePointerQuery, reducedMotionQuery } from "@/lib/media";
import { type ScrollMotion, watchScrollMotion } from "@/lib/scroll-motion";
import { skyRgb } from "@/lib/theme";
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
uniform float u_time;
uniform vec2 u_pointer;
uniform vec3 u_ripple;
uniform vec2 u_scroll;
uniform float u_aurora;
uniform float u_planet;
uniform vec3 u_tintA;
uniform vec3 u_tintB;
uniform vec3 u_tintC;
uniform vec3 u_gold;
uniform vec3 u_rose;
uniform vec4 u_meteor;

const float nebulaSpeed = 0.025;
const float churnSpeed = 0.11;
const float iridSpeed = 0.07;
const float twinkleDepth = 0.2;
const float glitterSpeed = 2.6;
const float auroraSway = 0.13;
const float auroraRipple = 0.23;
const float auroraDrift = 0.04;
const float planetBreath = 0.45;
const float rimShimmer = 0.1;
const float nebulaParallax = 0.05;
const float nearParallax = 0.16;
const float midParallax = 0.1;
const float farParallax = 0.06;
const float planetRise = 0.12;
const float streakMax = 1.4;
const float meteorTravel = 0.75;
const float meteorTail = 0.24;
const float meteorWidth = 0.0028;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

vec3 starLayer(vec2 p, float scale, float thresh, float size, float bright, float t, vec2 off, float streak) {
  vec2 sp = p * scale + off;
  vec2 cell = floor(sp);
  vec2 pos = fract(sp);
  float h = hash(cell);
  vec3 glow = vec3(0.0);
  if (h > thresh) {
    vec2 center = vec2(0.2 + 0.6 * hash(cell + 1.3), 0.2 + 0.6 * hash(cell + 7.1));
    vec2 dvec = pos - center;
    float d = length(dvec * vec2(1.0, 1.0 / streak));
    float hp = hash(cell + 5.9);
    float hf = hash(cell + 9.4);
    float tw = 0.6 + 0.4 * sin(t * (1.0 + hf * 3.0) + hp * 40.0);
    tw *= 1.0 + twinkleDepth * sin(t * (2.2 + 2.6 * hf) + fract(hp * 7.0) * 6.2832);
    float core = smoothstep(size, 0.0, d);
    float glint = 0.0;
    if (h > 0.993) {
      vec2 g = abs(dvec);
      float sx = pow(max(0.0, 1.0 - g.x * 16.0), 3.0) * pow(max(0.0, 1.0 - g.y * 30.0), 1.0);
      float sy = pow(max(0.0, 1.0 - g.y * 16.0), 3.0) * pow(max(0.0, 1.0 - g.x * 30.0), 1.0);
      glint = (sx + sy) * (0.55 + 0.45 * sin(t * (0.8 + hf * 1.7) + hp * 17.0));
    }
    float temp = hash(cell + 3.3);
    vec3 tint = vec3(1.0);
    if (temp < 0.3) {
      tint = vec3(0.72, 0.83, 1.0);
    } else if (temp < 0.55) {
      tint = vec3(1.0);
    } else if (temp < 0.8) {
      tint = vec3(1.0, 0.88, 0.68);
    } else {
      tint = vec3(1.0, 0.68, 0.42);
    }
    glow = tint * (core + glint * 1.1) * tw * bright / sqrt(streak);
  }
  return glow;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float sp = u_scroll.x;
  float speed = abs(u_scroll.y);
  float streak = 1.0 + streakMax * speed * speed;
  vec2 np = p - vec2(0.0, sp * nebulaParallax);
  float t = u_time * nebulaSpeed;
  vec2 drift = vec2(t * 0.6, -t * 0.35);
  vec2 churn = 0.07 * vec2(sin(u_time * churnSpeed), cos(u_time * churnSpeed * 0.8));

  float m1 = smoothstep(0.45, 0.85, fbm(np * 1.6 + drift + churn));
  float m2 = smoothstep(0.50, 0.90, fbm(np * 2.4 - drift * 1.3 - churn + 5.0));
  float m3 = smoothstep(0.50, 0.90, fbm(np * 1.1 + drift * 0.7 + churn.yx + 11.0));
  float m = clamp(m1 + m2 + m3, 0.0, 1.0);

  float irid = 0.5 + 0.5 * sin(atan(p.y, p.x + 0.001) * 2.0 + u_time * iridSpeed);
  vec3 calm = u_tintA * m1 * 0.16 + u_tintB * m2 * 0.13 + u_tintC * m3 * 0.08;
  vec3 shifted = u_tintB * m1 * 0.14 + u_tintC * m2 * 0.12 + u_tintA * m3 * 0.09;
  vec3 cloud = mix(calm, shifted, irid) * 0.8;

  cloud = cloud * 0.7 + u_tintB * m * 0.06;

  float pd = length(p - u_pointer);
  cloud += u_gold * exp(-pd * pd * 6.0) * m * 0.25;

  vec3 col = vec3(0.027, 0.031, 0.059) + cloud;

  vec2 poff = u_pointer * 0.03;
  vec3 stars = starLayer(p + poff * 3.0 - vec2(0.0, sp * nearParallax), 30.0, 0.966, 0.06, 1.2, u_time, vec2(0.0), streak);
  stars += starLayer(p + poff * 1.6 - vec2(0.0, sp * midParallax), 55.0, 0.978, 0.048, 0.95, u_time, vec2(4.7), 1.0 + (streak - 1.0) * 0.6);
  stars += starLayer(p + poff * 0.8 - vec2(0.0, sp * farParallax), 90.0, 0.986, 0.036, 0.72, u_time, vec2(9.2), 1.0 + (streak - 1.0) * 0.3);

  vec2 gcell = floor(np * 220.0);
  float gh = hash(gcell);
  float glitter = step(0.9985, gh) * m * (0.5 + 0.5 * sin(u_time * glitterSpeed + hash(gcell + 3.7) * 6.2832));
  stars += vec3(0.9, 0.95, 1.0) * glitter * 0.7;

  if (u_aurora > 0.5) {
    float cy = 0.28 + sp * 0.05 + (0.035 + 0.02 * speed) * sin(p.x * 2.0 + u_time * auroraSway + sp * 2.4) + 0.01 * sin(p.x * 5.3 - u_time * auroraRipple - sp * 3.1);
    float by = (p.y - cy) * 5.0;
    float band = exp(-by * by);
    float rays = 0.55 + 0.45 * fbm(vec2(p.x * 7.0 + u_time * auroraDrift, u_time * 0.025));
    float shape = smoothstep(-0.6, 0.4, p.x) * smoothstep(1.4, 0.5, abs(p.x));
    float hgt = clamp((p.y - (cy - 0.25)) / 0.5, 0.0, 1.0);
    vec3 aurCol = mix(u_tintC, u_tintB, smoothstep(0.0, 0.55, hgt));
    aurCol = mix(aurCol, u_rose, smoothstep(0.55, 1.0, hgt));
    col += aurCol * band * rays * shape * 0.35;
  }

  if (u_planet > 0.5) {
    float rise = 1.0 + sp * planetRise / 0.42;
    vec2 pc = vec2(0.12, -1.28 + rise * 0.42);
    vec2 pp = (p - pc) * vec2(1.0, 1.35);
    float rr = 0.62;
    float d = length(pp);
    float vis = smoothstep(0.0, 0.15, rise);
    float body = smoothstep(rr, rr - 0.02, d);
    float limb = 1.0 - body * (d / rr);
    vec3 bodyCol = mix(vec3(0.10, 0.07, 0.16), vec3(0.05, 0.03, 0.09), limb);
    float ang = atan(pp.y, pp.x);
    vec3 rimCol = mix(u_rose, u_gold, 0.5 + 0.5 * sin(ang + 0.6 + u_time * rimShimmer));
    float breath = 1.0 + 0.06 * sin(u_time * planetBreath);
    float rim = exp(-abs(d - rr) * 22.0);
    float atmo = exp(-max(d - rr, 0.0) * 7.0);
    vec3 atmoCol = mix(u_tintB, u_tintC, clamp((d - rr) * 3.0, 0.0, 1.0));
    col = mix(col, bodyCol, body * vis);
    col += (rimCol * rim * 0.8 + atmoCol * atmo * 0.35) * vis * breath;
  }

  float rd = length(p - u_ripple.xy);
  float rx = (rd - u_ripple.z * 0.55) * 9.0;
  float ring = exp(-rx * rx) * max(0.0, 1.0 - u_ripple.z / 1.6);
  col += (u_tintA * 0.6 + vec3(0.4)) * ring * 0.18;

  if (u_meteor.w < 1.0) {
    vec2 dir = vec2(cos(u_meteor.z), sin(u_meteor.z));
    vec2 rel = p - (u_meteor.xy + dir * u_meteor.w * meteorTravel);
    float behind = dot(rel, -dir);
    float across = dot(rel, vec2(-dir.y, dir.x)) / meteorWidth;
    float trail = smoothstep(meteorTail, 0.0, behind) * step(-0.003, behind) * exp(-across * across);
    float head = exp(-dot(rel, rel) / 0.00005);
    float fade = sin(3.14159 * u_meteor.w);
    stars += vec3(0.92, 0.96, 1.0) * (trail * 0.9 + head * 1.4) * fade;
  }

  float vignette = smoothstep(0.1, 0.9, length(uv - 0.5) * 1.3);
  float dim = mix(0.35, 1.0, vignette);
  col *= dim;
  col = min(col, vec3(0.32));
  col += min(stars * mix(0.5, 1.0, vignette), vec3(0.9));
  gl_FragColor = vec4(col, 1.0);
}`;

interface QualityLevel {
  aurora: boolean;
  planet: boolean;
  scale: number;
}

type SpaceState = "fallback" | "paused" | "running" | "static";

const LEVELS: QualityLevel[] = [
  { aurora: true, planet: true, scale: 0.5 },
  { aurora: true, planet: true, scale: 0.35 },
  { aurora: false, planet: false, scale: 0.3 },
];

const frameDt = 1000 / 60;
const activeFrameMs = 10.8;
const followRate = 3.7;
const rippleSeconds = 1.6;
const rippleHoldMs = rippleSeconds * 1000 - pacerIdleMs;
const resizeDelayMs = 150;
const meteorMs = 1100;
const meteorGapMs: [number, number] = [15_000, 30_000];

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
  const uTime = gl.getUniformLocation(program, "u_time");
  const uPointer = gl.getUniformLocation(program, "u_pointer");
  const uRipple = gl.getUniformLocation(program, "u_ripple");
  const uScroll = gl.getUniformLocation(program, "u_scroll");
  const uAurora = gl.getUniformLocation(program, "u_aurora");
  const uPlanet = gl.getUniformLocation(program, "u_planet");
  const uTintA = gl.getUniformLocation(program, "u_tintA");
  const uTintB = gl.getUniformLocation(program, "u_tintB");
  const uTintC = gl.getUniformLocation(program, "u_tintC");
  const uGold = gl.getUniformLocation(program, "u_gold");
  const uRose = gl.getUniformLocation(program, "u_rose");
  const uMeteor = gl.getUniformLocation(program, "u_meteor");

  const tintA = skyRgb("blue");
  const tintB = skyRgb("violet");
  const tintC = skyRgb("teal");
  const gold = skyRgb("gold");
  const rose = skyRgb("rose");
  gl.uniform3f(uTintA, tintA[0], tintA[1], tintA[2]);
  gl.uniform3f(uTintB, tintB[0], tintB[1], tintB[2]);
  gl.uniform3f(uTintC, tintC[0], tintC[1], tintC[2]);
  gl.uniform3f(uGold, gold[0], gold[1], gold[2]);
  gl.uniform3f(uRose, rose[0], rose[1], rose[2]);

  let level = 0;
  let rafId = 0;
  let frozen = false;
  const pointer = { x: 0, y: 0.3 };
  const pointerTarget = { x: 0, y: 0.3 };
  const ripple = { age: rippleSeconds, x: 0, y: 0 };
  const meteor = { angle: 0, at: 0, x: 0, y: 0 };
  const launch = (now: number): void => {
    meteor.at = now + nextGap();
    const aspect = canvas.width / Math.max(1, canvas.height);
    const side = Math.random() < 0.5 ? -1 : 1;
    const tilt = 0.35 + Math.random() * 0.35;
    meteor.x = side * (0.15 + Math.random() * 0.3) * aspect;
    meteor.y = 0.25 + Math.random() * 0.2;
    meteor.angle = side < 0 ? -tilt : Math.PI + tilt;
  };
  launch(performance.now());
  const hoverPointer = globalThis.matchMedia(finePointerQuery);
  const scroll: ScrollMotion = { progress: 0, velocity: 0 };
  let resizeTimer: ReturnType<typeof globalThis.setTimeout> | undefined;

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
    const scale = entry.scale * Math.min(window.devicePixelRatio, 1);
    const width = Math.max(1, Math.floor(canvas.clientWidth * scale));
    const height = Math.max(1, Math.floor(canvas.clientHeight * scale));
    if (width === canvas.width && height === canvas.height) return;
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
  };

  const frame = (now: number, dt = frameDt): void => {
    const current = LEVELS[level] ?? LEVELS[0];
    if (!current) return;
    const follow = 1 - Math.exp((-followRate * dt) / 1000);
    pointer.x += (pointerTarget.x - pointer.x) * follow;
    pointer.y += (pointerTarget.y - pointer.y) * follow;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, now / 1000);
    gl.uniform2f(uScroll, scroll.progress, scroll.velocity);
    gl.uniform2f(uPointer, pointer.x, pointer.y);
    if (ripple.age < rippleSeconds) ripple.age += dt / 1000;
    gl.uniform3f(uRipple, ripple.x, ripple.y, ripple.age);
    gl.uniform1f(uAurora, current.aurora ? 1 : 0);
    gl.uniform1f(uPlanet, current.planet ? 1 : 0);
    const flight = rafId ? (now - meteor.at) / meteorMs : -1;
    if (flight >= 1) launch(now);
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

  const stop = (): void => {
    if (rafId) globalThis.cancelAnimationFrame(rafId);
    rafId = 0;
    pacer.reset();
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
    if (document.hidden) {
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
    if (reduceMotion.matches || !hoverPointer.matches) return;
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    pointerTarget.x = (event.clientX / window.innerWidth - 0.5) * aspect;
    pointerTarget.y = 0.5 - event.clientY / window.innerHeight;
  };
  const onDown = (event: PointerEvent): void => {
    if (reduceMotion.matches) return;
    markActive(rippleHoldMs);
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    ripple.x = (event.clientX / window.innerWidth - 0.5) * aspect;
    ripple.y = 0.5 - event.clientY / window.innerHeight;
    ripple.age = 0;
  };
  const applyResize = (): void => {
    resizeTimer = undefined;
    markActive();
    resize();
    if (!rafId) frame(performance.now());
  };
  const onResize = (): void => {
    if (resizeTimer !== undefined) globalThis.clearTimeout(resizeTimer);
    resizeTimer = globalThis.setTimeout(applyResize, resizeDelayMs);
  };
  const onScroll = (motion: ScrollMotion, settled: boolean): void => {
    scroll.progress = motion.progress;
    scroll.velocity = motion.velocity;
    markActive();
    if (settled && !rafId) frame(performance.now());
  };
  const onBlur = (): void => {
    stop();
    setState("paused");
  };

  resize();
  frame(performance.now());
  sync();

  window.addEventListener("resize", onResize);
  const stopScroll = watchScrollMotion(onScroll);
  globalThis.addEventListener("pointermove", onPointer, { passive: true });
  globalThis.addEventListener("pointerdown", onDown, { passive: true });
  window.addEventListener("blur", onBlur);
  window.addEventListener("focus", sync);
  document.addEventListener("visibilitychange", sync);
  reduceMotion.addEventListener("change", sync);
  return () => {
    stop();
    if (resizeTimer !== undefined) globalThis.clearTimeout(resizeTimer);
    stopScroll();
    window.removeEventListener("resize", onResize);
    globalThis.removeEventListener("pointermove", onPointer);
    globalThis.removeEventListener("pointerdown", onDown);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("focus", sync);
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
      canvas.dataset.spaceState = state;
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
