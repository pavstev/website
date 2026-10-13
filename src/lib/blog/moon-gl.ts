import { createFramePacer } from "../frame-pacer.ts";
import { createListeners } from "../listeners.ts";
import { reducedMotionQuery } from "../media.ts";
import { stillQuery } from "../motion-pause.ts";
import {
  compose,
  createProgram,
  createSphere,
  normalMatrix,
  orthographic,
  whenLinked,
} from "../planet-gl.ts";
import { isSceneHeld, sceneHoldEvent } from "../scene-hold.ts";
import { isSoftwareRenderer } from "../webgl.ts";
import {
  moonPhase,
  moonPosition,
  type Orbit,
  orbitFor,
  startAngle,
} from "./moons.ts";

export interface MoonBody {
  node: HTMLElement;
  radius: number;
  slug: string;
}

export interface MoonLink {
  from: number;
  node: SVGLineElement;
  to: number;
}

export interface MoonScene {
  dispose: () => void;
  setActive: (slug: null | string) => void;
}

interface MoonState extends MoonBody {
  angle: number;
  depth: number;
  hot: number;
  hotGoal: number;
  orbit: Orbit;
  seed: number;
  side: string;
  x: number;
  y: number;
}

const frameMs = 1000 / 30;
const maxPixelRatio = 2;
const near = -2000;
const far = 2000;
const hotEaseMs = 220;
const activeSlow = 0.75;
const lineGap = 3;

const vertex = `
varying vec3 vObj;
varying vec3 vNormal;
varying float vZ;
void main() {
  vObj = position;
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  vZ = viewPosition.z;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * viewPosition;
}
`;

const fragment = `
uniform vec3 uLight;
uniform vec3 uEclipse;
uniform float uHot;
uniform float uBack;
uniform float uSeed;
varying vec3 vObj;
varying vec3 vNormal;
varying float vZ;
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x),
        mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x),
        mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
float craters(vec3 q, float scale, float seed) {
  vec3 g = q * scale + seed;
  vec3 id = floor(g);
  vec3 off = vec3(hash3(id + 1.7), hash3(id + 5.1), hash3(id + 9.3)) - 0.5;
  float d = length(fract(g) - 0.5 - off * 0.45);
  float on = step(0.45, hash3(id + 3.3));
  float size = 0.16 + 0.16 * hash3(id + 7.7);
  float bowl = smoothstep(size, size * 0.5, d);
  float lip = smoothstep(size * 0.7, size, d) * smoothstep(size * 1.4, size, d);
  return on * (lip * 0.6 - bowl * 0.55);
}
void main() {
  if (vZ < 0.0 && distance(gl_FragCoord.xy, uEclipse.xy) < uEclipse.z) discard;
  vec3 q = normalize(vObj);
  float maria = smoothstep(0.42, 0.64, noise3(q * 1.7 + uSeed * 7.0));
  float grain = noise3(q * 9.0 + uSeed) * 0.5 + noise3(q * 23.0) * 0.25;
  float pits = craters(q, 3.0, uSeed * 11.0) + craters(q, 6.5, uSeed * 5.0) * 0.6;
  vec3 albedo = mix(vec3(0.5, 0.48, 0.46), vec3(0.24, 0.24, 0.26), maria * 0.75);
  albedo *= 0.8 + 0.35 * grain + pits * 0.5;
  vec3 n = normalize(vNormal);
  float ndl = dot(n, uLight);
  float lit = smoothstep(-0.05, 0.45, ndl) * 0.3 + max(ndl, 0.0) * 0.9;
  vec3 col = albedo * (0.03 + lit);
  float rim = pow(1.0 - max(n.z, 0.0), 3.0);
  col += vec3(1.0, 0.8, 0.6) * rim * (0.16 + 0.6 * uBack) * (1.0 + 1.4 * uHot);
  col += vec3(0.05, 0.07, 0.1) * uHot;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export const initMoons = (
  canvas: HTMLCanvasElement,
  stage: HTMLElement,
  eclipse: HTMLElement,
  bodies: readonly MoonBody[],
  links: readonly MoonLink[]
): MoonScene => {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: true,
    depth: true,
    powerPreference: "low-power",
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    stencil: false,
  });
  if (!gl) throw new Error("webgl2 unavailable");
  const loseContext = (): void => {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };
  if (isSoftwareRenderer(gl)) {
    loseContext();
    throw new Error("software renderer");
  }
  const checkErrors = process.env.NODE_ENV !== "production";
  const reduce = globalThis.matchMedia(reducedMotionQuery);
  const still = stillQuery();
  let pixelRatio = Math.min(globalThis.devicePixelRatio || 1, maxPixelRatio);
  let sphere = createSphere(gl, 36, 24);
  let program = createProgram(gl, vertex, fragment);
  const releaseGl = (): void => {
    sphere.dispose();
    program.dispose();
    loseContext();
  };

  const moons: MoonState[] = bodies.map((body, index) => ({
    ...body,
    angle: startAngle(index, bodies.length),
    depth: 0,
    hot: 0,
    hotGoal: 0,
    orbit: { period: 60, rx: 0, ry: 0, tilt: 0 },
    seed: (index * 0.37 + 0.11) % 1,
    side: "",
    x: 0,
    y: 0,
  }));

  let width = 1;
  let height = 1;
  let projection = orthographic(1, 1, near, far);
  let handle = 0;
  let visible = true;
  let frozen = false;
  let lost = false;
  let generation = 0;
  let compiled = false;
  let linesShown = false;

  const resize = (): void => {
    width = Math.max(1, stage.clientWidth);
    height = Math.max(1, stage.clientHeight);
    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);
    projection = orthographic(width, height, near, far);
    const radius = eclipse.offsetWidth / 2;
    const viewport = {
      height: globalThis.innerHeight,
      width: globalThis.innerWidth,
    };
    for (const [index, moon] of moons.entries()) {
      moon.orbit = orbitFor(index, moons.length, radius, viewport);
    }
  };

  const place = (): void => {
    for (const moon of moons) {
      const point = moonPosition(moon.orbit, moon.angle);
      moon.x = point.x;
      moon.y = point.y;
      moon.depth = point.depth;
      moon.node.style.translate = `${point.x.toFixed(2)}px ${point.y.toFixed(2)}px`;
      const side = `${point.x >= 0 ? "end" : "start"} ${point.depth < 0 ? "front" : "back"}`;
      if (side === moon.side) {
        continue;
      }

      moon.side = side;
      moon.node.dataset["side"] = side;
    }
    if (!linesShown) return;
    const cx = width / 2;
    const cy = height / 2;
    for (const link of links) {
      const a = moons[link.from];
      const b = moons[link.to];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy) || 1;
      const startGap = (a.radius + lineGap) / length;
      const endGap = (b.radius + lineGap) / length;
      link.node.setAttribute("x1", (cx + a.x + dx * startGap).toFixed(2));
      link.node.setAttribute("y1", (cy + a.y + dy * startGap).toFixed(2));
      link.node.setAttribute("x2", (cx + b.x - dx * endGap).toFixed(2));
      link.node.setAttribute("y2", (cy + b.y - dy * endGap).toFixed(2));
    }
  };

  const render = (): void => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.disable(gl.BLEND);
    const { uniform } = program;
    gl.useProgram(program.program);
    gl.uniformMatrix4fv(uniform("projectionMatrix"), false, projection);
    const scale = canvas.width / width;
    gl.uniform3f(
      uniform("uEclipse"),
      (width / 2) * scale,
      (height / 2) * scale,
      (eclipse.offsetWidth / 2) * scale
    );
    gl.bindVertexArray(sphere.vao);
    for (const moon of moons) {
      const model = compose(
        [width / 2 + moon.x, -(height / 2 + moon.y), -moon.depth],
        [0.4, moon.seed * 6.28, 0],
        moon.radius * (1 + moon.hot * 0.06)
      );
      const length = Math.hypot(moon.x, moon.y, moon.depth) || 1;
      gl.uniformMatrix4fv(uniform("modelViewMatrix"), false, model);
      gl.uniformMatrix3fv(uniform("normalMatrix"), false, normalMatrix(model));
      gl.uniform3f(
        uniform("uLight"),
        -moon.x / length,
        moon.y / length,
        moon.depth / length
      );
      gl.uniform1f(uniform("uHot"), moon.hot);
      gl.uniform1f(uniform("uBack"), 1 - moonPhase(moon.depth, moon.x));
      gl.uniform1f(uniform("uSeed"), moon.seed);
      gl.drawElements(gl.TRIANGLES, sphere.count, gl.UNSIGNED_SHORT, 0);
    }
    gl.bindVertexArray(null);
  };

  const draw = (): void => {
    if (!compiled || lost) return;
    place();
    render();
    stage.dataset["moons"] = "gl";
  };

  const advance = (dt: number): void => {
    const seconds = dt / 1000;
    const ease = 1 - Math.exp(-dt / hotEaseMs);
    for (const moon of moons) {
      moon.hot += (moon.hotGoal - moon.hot) * ease;
      const speed = 1 - activeSlow * moon.hot;
      moon.angle += ((seconds * Math.PI * 2) / moon.orbit.period) * speed;
      if (moon.angle > Math.PI * 4) moon.angle -= Math.PI * 2;
    }
  };

  const settle = (): void => {
    for (const [index, moon] of moons.entries()) {
      moon.hot = moon.hotGoal;
      if (reduce.matches) moon.angle = startAngle(index, moons.length);
    }
  };

  const pacer = createFramePacer({
    activeFrameMs: frameMs,
    canDowngrade: () => pixelRatio > 1,
    downgrade: () => {
      pixelRatio = 1;
      resize();
    },
  });

  const stop = (): void => {
    if (handle !== 0) cancelAnimationFrame(handle);
    handle = 0;
    pacer.reset();
  };

  const loop = (now: number): void => {
    handle = requestAnimationFrame(loop);
    const step = pacer.step(now);
    if (step.kind === "freeze") {
      frozen = true;
      sync();
      return;
    }
    if (step.kind !== "draw") return;
    advance(step.dt);
    draw();
  };

  const sync = (): void => {
    stop();
    if (lost || !compiled) return;
    if (
      frozen ||
      !visible ||
      document.hidden ||
      still.matches ||
      isSceneHeld()
    ) {
      settle();
      draw();
      return;
    }
    handle = requestAnimationFrame(loop);
  };

  let disposed = false;
  const compileProgram = (): void => {
    const mine = generation;
    void whenLinked(
      gl,
      [program],
      checkErrors,
      () => disposed || mine !== generation
    )
      .then(() => {
        if (disposed || lost || mine !== generation) return;
        compiled = true;
        settle();
        draw();
        sync();
      })
      .catch(() => {
        if (mine !== generation) return;
        lost = true;
        stop();
      });
  };

  const listeners = createListeners();
  const listen = listeners.on;
  const sizeWatch = new ResizeObserver(() => {
    resize();
    draw();
  });
  sizeWatch.observe(stage);
  const viewWatch = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    sync();
  });
  viewWatch.observe(stage);
  still.addEventListener("change", sync);
  listeners.add(() => {
    still.removeEventListener("change", sync);
  });
  listen(globalThis.window, sceneHoldEvent, sync);
  listen(globalThis.window, "blur", stop);
  listen(globalThis.window, "focus", sync);
  listen(document, "visibilitychange", sync);
  listen(canvas, "webglcontextlost", (event) => {
    event.preventDefault();
    lost = true;
    generation += 1;
    stop();
    stage.dataset["moons"] = "css";
  });
  listen(canvas, "webglcontextrestored", () => {
    if (disposed) return;
    try {
      sphere = createSphere(gl, 36, 24);
      program = createProgram(gl, vertex, fragment);
    } catch {
      lost = true;
      return;
    }
    compiled = false;
    lost = false;
    compileProgram();
  });

  resize();
  compileProgram();

  return {
    dispose: (): void => {
      disposed = true;
      stop();
      sizeWatch.disconnect();
      viewWatch.disconnect();
      listeners.dispose();
      releaseGl();
      stage.dataset["moons"] = "css";
    },
    setActive: (slug): void => {
      for (const moon of moons) moon.hotGoal = moon.slug === slug ? 1 : 0;
      linesShown = links.some(
        (link) =>
          moons[link.from]?.slug === slug || moons[link.to]?.slug === slug
      );
      if (linesShown) place();
      if (frozen) frozen = false;
      if (handle === 0) sync();
    },
  };
};
