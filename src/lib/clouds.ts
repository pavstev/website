import {
  BufferGeometry,
  Camera,
  DataTexture,
  Float32BufferAttribute,
  GLSL3,
  LinearFilter,
  Mesh,
  RawShaderMaterial,
  RepeatWrapping,
  Scene,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
} from "three";

import { createFrameClock } from "@/lib/frame-clock";
import { createFramePacer, pacerIdleMs } from "@/lib/frame-pacer";
import { finePointerQuery, reducedMotionQuery } from "@/lib/media";
import { isSceneHeld, sceneHoldEvent } from "@/lib/scene-hold";
import { watchScrollMotion } from "@/lib/scroll-motion";
import { skyRgb } from "@/lib/theme";

type CloudsState = "frozen" | "paused" | "running" | "static";

interface QualityLevel {
  octaves: number;
  scale: number;
  steps: number;
}

const levels: QualityLevel[] = [
  { octaves: 5, scale: 0.4, steps: 3 },
  { octaves: 5, scale: 0.28, steps: 3 },
  { octaves: 4, scale: 0.28, steps: 1 },
];

const finePixelRatio = 1;
const coarsePixelRatio = 0.8;
const activeFrameMs = 14;
const resizeDelayMs = 150;
const pulseSeconds = 2.6;
const pulseGapMs = 1200;
const pointerFollow = 2.2;
const timeOffset = 40;
const noiseSize = 256;
const wrapPeriod = noiseSize * 16;
const farDrift: [number, number] = [0.018, 0.002];
const nearDrift: [number, number] = [0.03, -0.003];
const highDrift: [number, number] = [0.07, 0.004];
const evolveDrift: [number, number] = [0.024, 0.017];
const farParallax: [number, number, number] = [0.012, 0.008, 0.06];
const nearParallax: [number, number, number] = [0.03, 0.02, 0.16];
const highParallax: [number, number, number] = [0.006, 0.004, 0.03];
const partFollow = 7;
const partFade = 2.5;
const cardPad = 1.04;
const wideFloor = 0.2;
const narrowFloor = 0.38;

const vertexShader = `
in vec3 position;
void main() {
  gl_Position = vec4(position, 1.0);
}`;

const fragmentShader = `
precision highp float;
uniform sampler2D u_noise;
uniform vec2 u_res;
uniform vec4 u_card;
uniform float u_floor;
uniform vec4 u_far;
uniform vec4 u_near;
uniform vec4 u_high;
uniform vec3 u_part;
uniform float u_time;
uniform vec2 u_evolve;
uniform vec2 u_pulse;
uniform int u_steps;
uniform int u_octaves;
uniform vec3 u_ambient;
uniform vec3 u_warm;
uniform vec3 u_cool;
out vec4 fragColor;

const mat2 octave = mat2(1.6, 1.2, -1.2, 1.6);
const vec2 lightDir = vec2(0.16, -0.99);
const float lightReach = 0.32;
const float absorb = 7.0;
const float warpAmount = 0.72;
const float softness = 0.2;
const float peak = 0.33;
const float exposure = 1.8;
const float silver = 1.4;
const float billow = 0.05;
const float partRadius = 0.022;

float noise(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return textureLod(u_noise, (i + f + 0.5) / ${String(noiseSize)}.0, 0.0).r;
}

float fbm(vec2 q, int octaves) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    sum += amp * noise(q);
    norm += amp;
    q = octave * q;
    amp *= 0.52;
  }
  return sum / norm;
}

float parting(vec2 p) {
  vec2 d = p - u_part.xy;
  return u_part.z * exp(-dot(d, d) / partRadius);
}

vec4 deck(vec2 q, float cover, vec3 light, float clear) {
  vec2 e = q * 0.3 + u_evolve;
  vec2 warp = vec2(noise(e), noise(e + vec2(5.2, 1.3))) - 0.5;
  vec2 qw = q + warp * warpAmount;
  cover += billow * sin(u_time * 0.21 + noise(q * 0.17 + 3.1) * 6.2832);
  cover += clear * 0.22;
  float n = fbm(qw, u_octaves);
  float d = smoothstep(cover, cover + softness, n);
  if (d < 0.003) return vec4(0.0);
  float stepLen = lightReach / float(u_steps);
  int lightOctaves = max(u_octaves - 2, 2);
  float depth = 0.0;
  for (int s = 1; s <= 3; s++) {
    if (s > u_steps) break;
    vec2 lq = qw + lightDir * stepLen * (float(s) - 0.5);
    depth += smoothstep(cover, cover + softness, fbm(lq, lightOctaves)) * stepLen;
  }
  float lit = exp(-absorb * depth);
  float powder = 1.0 - exp(-3.0 * d);
  float edge = d * (1.0 - d) * 4.0;
  vec3 col = u_ambient * d * (0.55 + 0.45 * n) + light * lit * powder;
  col += mix(light, vec3(1.0), 0.45) * edge * lit * silver * 0.35;
  return vec4(col, d);
}

vec4 wisps(vec2 q, vec3 light) {
  vec2 e = q * vec2(0.18, 0.5) + u_evolve * 1.6;
  float bend = noise(e) - 0.5;
  vec2 qs = vec2(q.x + bend * 0.9, q.y + bend * 0.35);
  float n = fbm(qs, 3);
  float d = smoothstep(0.54, 0.8, n);
  return vec4(mix(light, vec3(1.0), 0.35) * d * 0.55, d);
}

float roundedBox(vec2 p, vec2 size, float r) {
  vec2 q = abs(p) - size + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  vec3 light = mix(u_warm, u_cool, smoothstep(-0.45, 0.35, p.y));

  float clear = parting(p);
  vec2 away = (p - u_part.xy) * clear * 0.6;

  vec2 hp = p + u_high.zw - away * 0.4;
  float highBand = smoothstep(-0.1, 0.45, hp.y);
  vec4 high = vec4(0.0);
  if (highBand > 0.003) {
    high = wisps(hp * vec2(1.1, 7.0) + u_high.xy + vec2(13.0, 47.0), light);
    high *= highBand * (1.0 - 0.6 * clear);
  }

  vec2 fp = p + u_far.zw - away * 0.6;
  float farBand = 0.4 + 0.6 * smoothstep(-0.25, 0.45, fp.y);
  vec4 far = deck(fp * vec2(2.4, 3.2) + u_far.xy, 0.48 - 0.05 * farBand, light * 0.7, clear * 0.6);
  far.rgb *= farBand;

  vec2 np = p + u_near.zw - away;
  float nearBand = smoothstep(0.2, -0.5, np.y);
  vec4 near = vec4(0.0);
  if (nearBand > 0.003) {
    near = deck(np * vec2(1.9, 2.6) + u_near.xy + vec2(31.0, 17.0), 0.48 - 0.08 * nearBand, light, clear);
    near.rgb *= nearBand;
  }

  vec3 col = high.rgb * (1.0 - 0.6 * far.a) + far.rgb;
  col = col * (1.0 - 0.75 * near.a * nearBand) + near.rgb;

  float gust = u_pulse.y * exp(-pow((p.x - u_pulse.x) * 1.8, 2.0));
  col *= 1.0 + gust;

  col *= exposure;
  float level = max(max(col.r, col.g), max(col.b, 0.0001));
  col *= peak * (1.0 - exp(-level / peak)) / level;
  float card = roundedBox(p - u_card.xy, u_card.zw, 0.12);
  col *= mix(u_floor, 1.0, smoothstep(0.0, 0.2, card));
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  fragColor = vec4(max(col, 0.0), 1.0);
}`;

const createRandom = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = Math.imul(state + 0x6d_2b_79_f5, 1);
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
};

const buildNoise = (): DataTexture => {
  const random = createRandom(7);
  const data = Uint8Array.from({ length: noiseSize * noiseSize * 4 }, () =>
    Math.floor(random() * 256)
  );
  const texture = new DataTexture(data, noiseSize, noiseSize);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
};

const wrap = (value: number): number =>
  value - Math.floor(value / wrapPeriod) * wrapPeriod;

const tone = (name: Parameters<typeof skyRgb>[0], gain: number): Vector3 =>
  new Vector3(...skyRgb(name)).multiplyScalar(gain);

export const initClouds = (
  canvas: HTMLCanvasElement,
  context: WebGL2RenderingContext
): (() => void) => {
  const reduceMotion = globalThis.matchMedia(reducedMotionQuery);
  const finePointer = globalThis.matchMedia("(pointer: fine)").matches;
  const hoverPointer = globalThis.matchMedia(finePointerQuery);
  const pixelRatioCap = finePointer ? finePixelRatio : coarsePixelRatio;
  let reduced = reduceMotion.matches;
  const renderer = new WebGLRenderer({
    alpha: false,
    antialias: false,
    canvas,
    context,
    depth: false,
    powerPreference: "low-power",
    stencil: false,
  });
  renderer.autoClear = false;
  renderer.debug.checkShaderErrors = process.env.NODE_ENV !== "production";
  renderer.sortObjects = false;
  const scene = new Scene();
  const camera = new Camera();
  const noise = buildNoise();
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)
  );
  const uniforms = {
    u_ambient: { value: tone("violet", 0.2).lerp(tone("blue", 0.2), 0.4) },
    u_card: { value: new Vector4(0, 0, 0.5, 0.5) },
    u_cool: { value: tone("blue", 0.75).lerp(tone("teal", 0.75), 0.15) },
    u_evolve: { value: new Vector2() },
    u_far: { value: new Vector4() },
    u_floor: { value: wideFloor },
    u_high: { value: new Vector4() },
    u_near: { value: new Vector4() },
    u_noise: { value: noise },
    u_octaves: { value: levels[0]?.octaves ?? 4 },
    u_part: { value: new Vector3() },
    u_pulse: { value: new Vector2(0, 0) },
    u_res: { value: new Vector2(1, 1) },
    u_steps: { value: levels[0]?.steps ?? 1 },
    u_time: { value: 0 },
    u_warm: { value: tone("rose", 1.1).lerp(tone("gold", 1.1), 0.35) },
  };
  const material = new RawShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fragmentShader,
    glslVersion: GLSL3,
    uniforms,
    vertexShader,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const card = document.querySelector("[data-card]");
  const cardBox = { height: 0, top: 0, width: 0 };
  const view = { height: 1, width: 1 };
  const clock = createFrameClock(timeOffset * 1000);
  const pointer = { x: 0, y: 0 };
  const pointerTarget = { x: 0, y: 0 };
  const part = { strength: 0, target: 0, x: 0, y: 0 };
  const scroll = { progress: 0 };
  let level = 0;
  let rafId = 0;
  let prevRender = 0;
  let pulseAge = pulseSeconds;
  let lastPulse = -pulseGapMs;
  let visible = true;
  let ready = false;
  let lost = false;
  let frozen = false;
  let disposed = false;
  let sizeKey = "";
  let stillId = 0;
  let resizeTimer: ReturnType<typeof globalThis.setTimeout> | undefined;

  const setState = (state: CloudsState): void => {
    canvas.dataset["cloudsState"] = state;
  };

  const measureCard = (): void => {
    const rect = card?.getBoundingClientRect();
    if (!rect) return;
    cardBox.top = rect.top + window.scrollY;
    cardBox.width = rect.width;
    cardBox.height = rect.height;
    const cover = rect.width / view.width;
    const blend = Math.min(1, Math.max(0, (cover - 0.75) / 0.2));
    uniforms.u_floor.value = wideFloor + (narrowFloor - wideFloor) * blend;
  };

  const placeCard = (): void => {
    const { height } = view;
    if (cardBox.width === 0) {
      uniforms.u_card.value.set(0, 0, 0.5, 0.5);
      return;
    }
    const top = cardBox.top - window.scrollY;
    const centerY = (height / 2 - (top + cardBox.height / 2)) / height;
    uniforms.u_card.value.set(
      0,
      centerY,
      ((cardBox.width / 2) * cardPad) / height,
      ((cardBox.height / 2) * cardPad) / height
    );
  };

  const applySize = (): void => {
    const entry = levels[level] ?? levels[0];
    if (!entry) return;
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    view.width = width;
    view.height = height;
    const ratio =
      Math.min(globalThis.devicePixelRatio, pixelRatioCap) * entry.scale;
    const key = `${String(width)}x${String(height)}@${String(ratio)}`;
    if (key !== sizeKey) {
      sizeKey = key;
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, height, false);
      uniforms.u_res.value.set(canvas.width, canvas.height);
    }
    uniforms.u_octaves.value = entry.octaves;
    uniforms.u_steps.value = entry.steps;
    measureCard();
  };

  const pacer = createFramePacer({
    activeFrameMs,
    canDowngrade: () => level < levels.length - 1,
    downgrade: () => {
      level += 1;
      applySize();
    },
  });
  const { markActive } = pacer;

  const renderFrame = (now: number): void => {
    const dt =
      prevRender > 0 ? Math.min((now - prevRender) / 1000, 0.1) : 1 / 60;
    prevRender = now;
    const elapsed = reduced ? timeOffset : clock.tick(now) / 1000;
    const follow = 1 - Math.exp(-pointerFollow * dt);
    pointer.x += (pointerTarget.x - pointer.x) * follow;
    pointer.y += (pointerTarget.y - pointer.y) * follow;
    uniforms.u_far.value.set(
      wrap(elapsed * farDrift[0]),
      wrap(elapsed * farDrift[1]),
      pointer.x * farParallax[0],
      pointer.y * farParallax[1] + scroll.progress * farParallax[2]
    );
    uniforms.u_near.value.set(
      wrap(elapsed * nearDrift[0]),
      wrap(elapsed * nearDrift[1]),
      pointer.x * nearParallax[0],
      pointer.y * nearParallax[1] + scroll.progress * nearParallax[2]
    );
    uniforms.u_high.value.set(
      wrap(elapsed * highDrift[0]),
      wrap(elapsed * highDrift[1]),
      pointer.x * highParallax[0],
      pointer.y * highParallax[1] + scroll.progress * highParallax[2]
    );
    const aspect = view.width / view.height;
    const partStep = 1 - Math.exp(-partFollow * dt);
    part.x += (pointerTarget.x * aspect * 0.5 - part.x) * partStep;
    part.y += (pointerTarget.y * 0.5 - part.y) * partStep;
    part.strength +=
      (part.target - part.strength) * (1 - Math.exp(-partFade * dt));
    uniforms.u_part.value.set(part.x, part.y, reduced ? 0 : part.strength);
    uniforms.u_time.value = elapsed;
    uniforms.u_evolve.value.set(
      wrap(elapsed * evolveDrift[0]),
      wrap(elapsed * evolveDrift[1])
    );
    if (pulseAge < pulseSeconds) {
      pulseAge = Math.min(pulseSeconds, pulseAge + dt);
      const k = pulseAge / pulseSeconds;
      const half = uniforms.u_res.value.x / uniforms.u_res.value.y / 2;
      uniforms.u_pulse.value.set(
        -half - 0.5 + k * (2 * half + 1),
        Math.sin(Math.PI * k) * 0.7
      );
    } else {
      uniforms.u_pulse.value.set(0, 0);
    }
    placeCard();
    renderer.render(scene, camera);
  };

  const stopLoop = (): void => {
    if (rafId) globalThis.cancelAnimationFrame(rafId);
    rafId = 0;
    prevRender = 0;
    pacer.reset();
    clock.pause();
  };

  const freeze = (now: number): void => {
    frozen = true;
    stopLoop();
    renderFrame(now);
    setState("frozen");
  };

  const loop = (now: number): void => {
    rafId = globalThis.requestAnimationFrame(loop);
    const next = pacer.step(now);
    if (next.kind === "freeze") freeze(now);
    else if (next.kind === "draw") renderFrame(now);
  };

  const drawStill = (): void => {
    if (!ready || lost || rafId) return;
    clock.pause();
    renderFrame(performance.now());
  };

  const queueStill = (): void => {
    if (stillId || rafId || !ready || lost) return;
    stillId = globalThis.requestAnimationFrame(() => {
      stillId = 0;
      drawStill();
    });
  };

  const sync = (): void => {
    stopLoop();
    if (!ready || lost) return;
    if (reduced) {
      pulseAge = pulseSeconds;
      renderFrame(performance.now());
      setState("static");
      return;
    }
    if (!visible || document.hidden || isSceneHeld()) {
      pulseAge = pulseSeconds;
      setState("paused");
      return;
    }
    if (frozen) {
      renderFrame(performance.now());
      setState("frozen");
      return;
    }
    rafId = globalThis.requestAnimationFrame(loop);
    setState("running");
  };

  const disposers: Array<() => void> = [];
  const listen = (
    target: Document | HTMLCanvasElement | MediaQueryList | Window,
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions
  ): void => {
    target.addEventListener(type, listener, options);
    disposers.push(() => target.removeEventListener(type, listener, options));
  };

  listen(
    globalThis.window,
    "pointermove",
    (event: Event) => {
      if (reduced || !hoverPointer.matches || isSceneHeld()) return;
      const { clientX, clientY } = event as PointerEvent;
      pointerTarget.x = (clientX / window.innerWidth) * 2 - 1;
      pointerTarget.y = 1 - (clientY / window.innerHeight) * 2;
      part.target = 1;
      markActive();
    },
    { passive: true }
  );
  listen(document, "pointerout", (event: Event) => {
    if ((event as PointerEvent).relatedTarget) return;
    part.target = 0;
    markActive(1000);
  });
  listen(globalThis.window, "sky:pulse", () => {
    const now = performance.now();
    if (reduced || isSceneHeld() || now - lastPulse < pulseGapMs) return;
    lastPulse = now;
    pulseAge = 0;
    markActive(pulseSeconds * 1000 - pacerIdleMs);
  });
  const scheduleResize = (): void => {
    if (resizeTimer !== undefined) globalThis.clearTimeout(resizeTimer);
    resizeTimer = globalThis.setTimeout(() => {
      resizeTimer = undefined;
      markActive();
      applySize();
      drawStill();
    }, resizeDelayMs);
  };
  listen(globalThis.window, "resize", scheduleResize);
  listen(globalThis.window, "scroll", queueStill, { passive: true });
  listen(globalThis.window, "blur", () => {
    stopLoop();
    if (ready && !lost) setState("paused");
  });
  listen(globalThis.window, "focus", sync);
  listen(globalThis.window, sceneHoldEvent, sync);
  listen(document, "visibilitychange", sync);
  listen(reduceMotion, "change", () => {
    reduced = reduceMotion.matches;
    sync();
  });
  listen(canvas, "webglcontextlost", () => {
    lost = true;
    stopLoop();
    setState("paused");
  });
  listen(canvas, "webglcontextrestored", () => {
    lost = false;
    sizeKey = "";
    applySize();
    sync();
  });

  const observer = new IntersectionObserver(
    (entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      sync();
    },
    { threshold: 0 }
  );
  observer.observe(canvas);
  const cardObserver = new ResizeObserver(scheduleResize);
  if (card) cardObserver.observe(card);

  disposers.push(
    watchScrollMotion((motion, settled) => {
      scroll.progress = motion.progress;
      markActive();
      if (settled) drawStill();
    }),
    () => {
      if (resizeTimer !== undefined) globalThis.clearTimeout(resizeTimer);
    }
  );

  applySize();
  const start = (): void => {
    if (disposed) return;
    ready = true;
    renderFrame(performance.now());
    sync();
  };
  void renderer
    .compileAsync(scene, camera)
    .catch(() => undefined)
    .then(start);

  return () => {
    disposed = true;
    stopLoop();
    if (stillId) globalThis.cancelAnimationFrame(stillId);
    observer.disconnect();
    cardObserver.disconnect();
    for (const dispose of disposers) dispose();
    geometry.dispose();
    material.dispose();
    noise.dispose();
    renderer.dispose();
  };
};
