import { createFramePacer } from "@/lib/frame-pacer";
import { createListeners } from "@/lib/listeners";
import {
  createLogoMotion,
  type LogoMotion,
  logoSpin,
  settleLogoMotion,
  stepLogoMotion,
} from "@/lib/logo-motion";
import {
  createLogoPlanet,
  logoFragment,
  type LogoPlanet,
  logoVertex,
} from "@/lib/logo-planet";
import { finePointerQuery, reducedMotionQuery } from "@/lib/media";
import {
  type Color3,
  compose,
  createProgram,
  createRing,
  createSphere,
  type Geometry,
  type GlProgram,
  type Mat4,
  multiply,
  normalMatrix,
  offsetHsl,
  orthographic,
  parseHex,
  whenLinked,
} from "@/lib/planet-gl";
import { isSceneHeld, sceneHoldEvent } from "@/lib/scene-hold";
import { globePalette } from "@/lib/theme";
import { isSoftwareRenderer } from "@/lib/webgl";

export interface PlanetsControls {
  dispose: () => void;
}

interface BodyUniforms {
  uColor: Color3;
  uHot: number;
  uKind: number;
  uNight: Color3;
  uSeed: number;
  uSpin: number;
  uWarm: Color3;
}

interface LogoState extends Placed {
  hotGoal: number;
  inView: boolean;
  motion: LogoMotion;
  node: HTMLElement;
  planet: LogoPlanet;
}

interface Placed {
  position: Color3;
  scale: number;
  visible: boolean;
}

interface Planet extends Placed {
  body: BodyUniforms;
  color: Color3;
  hot: number;
  hotGoal: number;
  moon?: BodyUniforms;
  moonAngle: number;
  moonPosition: Color3;
  node: HTMLElement;
  ring: boolean;
  speed: number;
  spin: number;
  tilt: number;
}

const kinds = new Map<string, number>([
  ["bands", 1],
  ["craters", 3],
  ["moon", 2],
  ["ring", 0],
]);

const maxPixelRatio = 1.5;
const ringInner = 1.32;
const ringOuter = 1.74;
const ringTilt: Color3 = [1.18, -0.28, 0];
const moonOrbit = 1.56;
const moonSize = 0.2;
const bodyScale = 0.42;
const logoScale = 0.5;
const sunriseVisibility = 0.6;
const frameMs = 1000 / 30;
const near = -400;
const far = 400;
const origin3: Color3 = [0, 0, 0];

const commonNoise = `
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
`;

const planetVertex = `
varying vec3 vObj;
varying vec3 vNormal;
void main() {
  vObj = position;
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * viewPosition;
}
`;

const planetFragment = `
uniform vec3 uColor;
uniform vec3 uWarm;
uniform vec3 uNight;
uniform float uSpin;
uniform float uKind;
uniform float uHot;
uniform float uTime;
uniform float uSeed;
varying vec3 vObj;
varying vec3 vNormal;
${commonNoise}
void main() {
  vec3 p = normalize(vObj);
  float c = cos(uSpin);
  float s = sin(uSpin);
  vec3 q = vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  vec3 drift = vec3(0.0, uTime * 0.07, uTime * 0.05);
  float warp = noise3(q * 2.2 + drift + uSeed);
  vec3 n = normalize(vNormal);
  vec3 v = vec3(0.0, 0.0, 1.0);
  vec3 sun = normalize(vec3(-0.6, 0.55, 0.58));
  float ndl = dot(n, sun);
  float day = smoothstep(-0.18, 0.55, ndl);
  float pat;
  if (uKind < 0.5) {
    pat = noise3(q * 3.4 + warp * 1.6);
  } else if (uKind < 1.5) {
    pat = sin(q.y * 16.0 + warp * 3.4 + uTime * 0.35) * 0.5 + 0.5;
    pat = smoothstep(0.15, 0.85, pat);
  } else if (uKind < 2.5) {
    pat = noise3(q * 4.2 + warp * 2.0) * 0.75 + noise3(q * 10.0) * 0.25;
  } else {
    vec3 g = q * 3.4;
    vec3 id = floor(g);
    vec3 off = vec3(hash3(id + 1.7), hash3(id + 5.1), hash3(id + 9.3)) - 0.5;
    float d = length(fract(g) - 0.5 - off * 0.55);
    float on = step(0.45, hash3(id));
    float crater = on * (smoothstep(0.32, 0.24, d) - 0.5 * smoothstep(0.2, 0.08, d));
    pat = 0.45 + 0.5 * crater + 0.25 * warp;
  }
  pat = clamp(pat, 0.0, 1.0);
  vec3 lit = mix(uColor, uWarm, smoothstep(0.25, 1.0, ndl) * 0.7 + pat * 0.3);
  vec3 surface = mix(lit * 0.32, lit * 1.05, pat);
  vec3 col = mix(uNight * (0.18 + 0.2 * pat), surface, day);
  float terminator = smoothstep(0.22, 0.0, abs(ndl - 0.05));
  col += uWarm * terminator * 0.22;
  float facing = max(dot(n, v), 0.0);
  float breathe = 0.82 + 0.18 * sin(uTime * 1.4 + uSeed * 6.28);
  float rim = pow(1.0 - facing, 2.6) * breathe;
  col += mix(uNight, uColor, day * 0.6 + 0.4) * rim * (1.1 + 0.8 * uHot);
  col += vec3(1.0) * pow(max(dot(reflect(-sun, n), v), 0.0), 34.0) * 0.22 * day;
  col += uColor * 0.1 * uHot;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

const ringVertex = `
varying vec2 vPos;
void main() {
  vPos = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const ringFragment = `
uniform vec3 uColor;
uniform float uInner;
uniform float uOuter;
uniform float uHot;
uniform float uTime;
varying vec2 vPos;
void main() {
  float t = (length(vPos) - uInner) / (uOuter - uInner);
  float band = 0.5 + 0.5 * sin(t * 34.0 + uTime * 0.9) * sin(t * 9.0 - uTime * 0.4 + 1.0);
  float edge = smoothstep(0.0, 0.16, t) * smoothstep(1.0, 0.72, t);
  float alpha = edge * (0.38 + 0.5 * band) * (0.85 + 0.15 * uHot);
  gl_FragColor = vec4(uColor * (1.0 + 0.5 * uHot), alpha);
  #include <colorspace_fragment>
}
`;

const readColor = (node: HTMLElement): Color3 => {
  const value = getComputedStyle(node).getPropertyValue("--lang").trim();
  const fallback = parseHex(globePalette.coast) ?? [1, 1, 1];
  return value.startsWith("#") ? (parseHex(value) ?? fallback) : fallback;
};

const readTilt = (node: HTMLElement): number => {
  const value = Number(
    node.style.getPropertyValue("--p-tilt").replace("deg", "")
  );
  return Number.isFinite(value) ? value : 0;
};

export const initRepoPlanets = (
  canvas: HTMLCanvasElement,
  stage: HTMLElement
): PlanetsControls => {
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
  const nodes = [...stage.querySelectorAll<HTMLElement>(".repo-planet")];
  const logoNodes = [...stage.querySelectorAll<HTMLElement>(".logo-planet")];
  if (nodes.length === 0 && logoNodes.length === 0) {
    loseContext();
    throw new Error("no planets");
  }
  const checkErrors = process.env.NODE_ENV !== "production";
  const fine = globalThis.matchMedia(finePointerQuery);
  const reduce = globalThis.matchMedia(reducedMotionQuery);
  let pixelRatio = Math.min(globalThis.devicePixelRatio || 1, maxPixelRatio);
  const sphere = createSphere(gl, 40, 28);
  const ring = createRing(gl, ringInner, ringOuter, 72);
  const planetProgram = createProgram(gl, planetVertex, planetFragment);
  const ringProgram = createProgram(gl, ringVertex, ringFragment);
  const logoProgram = createProgram(gl, logoVertex, logoFragment);
  const programs = [planetProgram, ringProgram, logoProgram];
  const geometries = [sphere, ring];
  const ringFrame = compose(origin3, ringTilt, 1);
  let time = 0;
  const logos: LogoState[] = [];
  const releaseGl = (): void => {
    for (const logo of logos) logo.planet.dispose();
    for (const geometry of geometries) geometry.dispose();
    for (const program of programs) program.dispose();
    loseContext();
  };
  try {
    for (const node of logoNodes) {
      logos.push({
        hotGoal: 0,
        inView: false,
        motion: createLogoMotion(),
        node,
        planet: createLogoPlanet(node, gl),
        position: origin3,
        scale: 1,
        visible: true,
      });
    }
  } catch (error) {
    releaseGl();
    throw error;
  }

  let materialCount = 0;
  const makeBody = (color: Color3, kind: number): BodyUniforms => {
    const uniforms: BodyUniforms = {
      uColor: color,
      uHot: 0,
      uKind: kind,
      uNight: offsetHsl(color, -0.08, -0.1, -0.32),
      uSeed: (materialCount * 0.37) % 1,
      uSpin: 0,
      uWarm: offsetHsl(color, 0.07, 0.18, 0.12),
    };
    materialCount += 1;
    return uniforms;
  };

  const planets: Planet[] = nodes.map((node, index) => {
    const color = readColor(node);
    const kindName = node.dataset["kind"] ?? "ring";
    const kind = kinds.get(kindName) ?? 0;
    const planet: Planet = {
      body: makeBody(color, kind),
      color,
      hot: 0,
      hotGoal: 0,
      moonAngle: index * 2.1,
      moonPosition: origin3,
      node,
      position: origin3,
      ring: kindName === "ring",
      scale: 1,
      speed: 0.55 + index * 0.12,
      spin: index * 1.7,
      tilt: (-readTilt(node) * Math.PI) / 180,
      visible: true,
    };
    if (planet.ring) {
      materialCount += 1;
    } else if (kindName === "moon") {
      planet.moon = makeBody(color, 2);
    }
    return planet;
  });

  let width = 1;
  let height = 1;
  let projection = orthographic(1, 1, near, far);
  let handle = 0;
  let visible = true;
  let frozen = false;
  let lost = false;
  let ready = false;
  let compiled = false;

  const resize = (): void => {
    width = Math.max(1, stage.clientWidth);
    height = Math.max(1, stage.clientHeight);
    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);
    projection = orthographic(width, height, near, far);
  };

  const placeAt = (
    target: Placed,
    node: HTMLElement,
    scale: number,
    origin: DOMRect
  ): void => {
    const size = node.offsetWidth;
    const box = node.getBoundingClientRect();
    target.visible = size > 0;
    target.position = [
      box.left - origin.left + box.width / 2,
      -(box.top - origin.top + box.height / 2),
      0,
    ];
    target.scale = size * scale;
  };

  const place = (): void => {
    const origin = stage.getBoundingClientRect();
    for (const planet of planets) {
      placeAt(planet, planet.node, bodyScale * (1 + planet.hot * 0.07), origin);
    }
    for (const logo of logos) {
      placeAt(
        logo,
        logo.node,
        logoScale * (1 + logo.motion.hot * 0.07),
        origin
      );
    }
  };

  const bindProgram = ({ program, uniform }: GlProgram): void => {
    gl.useProgram(program);
    gl.uniformMatrix4fv(uniform("projectionMatrix"), false, projection);
    gl.uniform1f(uniform("uTime"), time);
  };

  const setModel = ({ uniform }: GlProgram, model: Mat4): void => {
    gl.uniformMatrix4fv(uniform("modelViewMatrix"), false, model);
    gl.uniformMatrix3fv(uniform("normalMatrix"), false, normalMatrix(model));
  };

  const drawGeometry = (geometry: Geometry): void => {
    gl.bindVertexArray(geometry.vao);
    gl.drawElements(gl.TRIANGLES, geometry.count, gl.UNSIGNED_SHORT, 0);
  };

  const drawBody = (uniforms: BodyUniforms, model: Mat4): void => {
    const { uniform } = planetProgram;
    setModel(planetProgram, model);
    gl.uniform3fv(uniform("uColor"), uniforms.uColor);
    gl.uniform3fv(uniform("uWarm"), uniforms.uWarm);
    gl.uniform3fv(uniform("uNight"), uniforms.uNight);
    gl.uniform1f(uniform("uSpin"), uniforms.uSpin);
    gl.uniform1f(uniform("uKind"), uniforms.uKind);
    gl.uniform1f(uniform("uHot"), uniforms.uHot);
    gl.uniform1f(uniform("uSeed"), uniforms.uSeed);
    drawGeometry(sphere);
  };

  const drawLogo = (logo: LogoState): void => {
    const { uniform } = logoProgram;
    const { texture, uniforms } = logo.planet;
    setModel(logoProgram, compose(logo.position, origin3, logo.scale));
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform3fv(uniform("uDisc"), uniforms.uDisc);
    gl.uniform3fv(uniform("uMark"), uniforms.uMark);
    gl.uniform3fv(uniform("uAccent"), uniforms.uAccent);
    gl.uniform3fv(uniform("uTint"), uniforms.uTint);
    gl.uniform1f(uniform("uEmboss"), uniforms.uEmboss);
    gl.uniform1f(uniform("uSpin"), uniforms.uSpin);
    gl.uniform1f(uniform("uHot"), uniforms.uHot);
    drawGeometry(sphere);
  };

  const drawRing = (planet: Planet, frame: Mat4): void => {
    const { uniform } = ringProgram;
    setModel(ringProgram, multiply(frame, ringFrame));
    gl.uniform3fv(uniform("uColor"), planet.color);
    gl.uniform1f(uniform("uHot"), planet.hot);
    drawGeometry(ring);
  };

  const prepare = (): void => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(
      0,
      0,
      Math.round(width * pixelRatio),
      Math.round(height * pixelRatio)
    );
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.frontFace(gl.CCW);
    gl.cullFace(gl.BACK);
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
  };

  const render = (): void => {
    prepare();
    const shown = planets.filter((planet) => planet.visible);
    const frames = shown.map((planet) =>
      compose(planet.position, [0, 0, planet.tilt], planet.scale)
    );
    bindProgram(planetProgram);
    for (const [index, planet] of shown.entries()) {
      const frame = frames[index];
      if (!frame) continue;
      drawBody(planet.body, frame);
      if (!planet.moon) continue;
      drawBody(
        planet.moon,
        multiply(frame, compose(planet.moonPosition, origin3, moonSize))
      );
    }
    const shownLogos = logos.filter((logo) => logo.visible);
    if (shownLogos.length > 0) {
      bindProgram(logoProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(logoProgram.uniform("uMask"), 0);
      for (const logo of shownLogos) drawLogo(logo);
    }
    if (shown.some((planet) => planet.ring)) {
      bindProgram(ringProgram);
      gl.uniform1f(ringProgram.uniform("uInner"), ringInner);
      gl.uniform1f(ringProgram.uniform("uOuter"), ringOuter);
      gl.disable(gl.CULL_FACE);
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFuncSeparate(
        gl.SRC_ALPHA,
        gl.ONE_MINUS_SRC_ALPHA,
        gl.ONE,
        gl.ONE_MINUS_SRC_ALPHA
      );
      for (const [index, planet] of shown.entries()) {
        const frame = frames[index];
        if (frame && planet.ring) drawRing(planet, frame);
      }
    }
    gl.bindVertexArray(null);
  };

  const draw = (): void => {
    if (!compiled || lost) return;
    place();
    render();
    if (ready) {
      return;
    }

    ready = true;
    canvas.dataset["ready"] = "";
    stage.dataset["planets"] = "gl";
  };

  const advance = (dt: number): void => {
    const seconds = dt / 1000;
    time += seconds;
    for (const planet of planets) {
      planet.hot += (planet.hotGoal - planet.hot) * (1 - Math.exp(-dt / 140));
      planet.spin += seconds * planet.speed * (1 + planet.hot * 2.4);
      planet.body.uSpin = planet.spin;
      planet.body.uHot = planet.hot;
      if (!planet.moon) {
        continue;
      }

      planet.moonAngle += seconds * (0.95 + planet.hot);
      planet.moonPosition = [
        Math.cos(planet.moonAngle) * moonOrbit,
        Math.sin(planet.moonAngle) * moonOrbit * 0.28,
        Math.sin(planet.moonAngle) * moonOrbit * 0.9,
      ];
    }
    for (const logo of logos) {
      logo.motion = stepLogoMotion(logo.motion, dt, {
        hotGoal: logo.hotGoal,
        started: ready && logo.inView,
      });
      logo.planet.uniforms.uSpin = logoSpin(logo.motion);
      logo.planet.uniforms.uHot = logo.motion.hot;
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

  const settleLogos = (): boolean => {
    let moved = false;
    for (const logo of logos) {
      if (logoSpin(logo.motion) !== 0) moved = true;
      logo.motion = settleLogoMotion(logo.motion);
    }
    return moved;
  };

  const sync = (): void => {
    stop();
    if (lost) return;
    const moved = (frozen || reduce.matches || isSceneHeld()) && settleLogos();
    if (reduce.matches) {
      advance(0);
      draw();
      return;
    }
    if (frozen || !visible || document.hidden || isSceneHeld()) {
      if (frozen || moved) {
        advance(0);
        draw();
      }
      return;
    }
    pacer.markActive();
    handle = requestAnimationFrame(loop);
  };

  const wake = (): void => {
    if (!frozen) {
      return;
    }

    frozen = false;
    sync();
  };

  const listeners = createListeners();
  const listen = listeners.on;

  for (const logo of logos) {
    const watcher = new IntersectionObserver(
      (entries) => {
        logo.inView =
          (entries.at(-1)?.intersectionRatio ?? 0) >= sunriseVisibility;
      },
      { threshold: sunriseVisibility }
    );
    watcher.observe(logo.node);
    listeners.add(() => {
      watcher.disconnect();
    });
  }

  for (const target of [...planets, ...logos]) {
    const tile = target.node.closest<HTMLElement>(".repo-tile");
    if (!tile) continue;
    listen(tile, "pointerenter", () => {
      if (!fine.matches) {
        return;
      }

      target.hotGoal = 1;
      wake();
    });
    listen(tile, "pointerleave", () => {
      target.hotGoal = 0;
    });
    listen(tile, "focusin", () => {
      if (!tile.querySelector(":focus-visible")) {
        return;
      }

      target.hotGoal = 1;
      wake();
    });
    listen(tile, "focusout", () => {
      target.hotGoal = 0;
    });
  }

  const observer = new ResizeObserver(() => {
    resize();
    if (!handle || reduce.matches) draw();
  });
  observer.observe(stage);
  const visibility = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    sync();
  });
  visibility.observe(stage);

  listen(globalThis.window, sceneHoldEvent, sync);
  listen(globalThis.window, "blur", stop);
  listen(globalThis.window, "focus", sync);
  listen(document, "visibilitychange", sync);
  listen(reduce, "change", sync);
  listen(canvas, "webglcontextlost", (event) => {
    event.preventDefault();
    lost = true;
    stop();
    delete canvas.dataset["ready"];
    delete stage.dataset["planets"];
  });

  let disposed = false;
  resize();
  advance(0);
  void whenLinked(gl, programs, checkErrors, () => disposed)
    .then(() => {
      if (disposed || lost) return;
      compiled = true;
      draw();
      sync();
    })
    .catch(() => {
      lost = true;
      stop();
    });

  return {
    dispose: (): void => {
      disposed = true;
      stop();
      observer.disconnect();
      visibility.disconnect();
      listeners.dispose();
      releaseGl();
      delete canvas.dataset["ready"];
      delete stage.dataset["planets"];
    },
  };
};
