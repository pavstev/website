import {
  Color,
  DoubleSide,
  Group,
  Mesh,
  OrthographicCamera,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  WebGLRenderer,
} from "three";

import { createFramePacer } from "@/lib/frame-pacer";
import {
  createLogoMotion,
  type LogoMotion,
  logoSpin,
  settleLogoMotion,
  stepLogoMotion,
} from "@/lib/logo-motion";
import { createLogoPlanet, type LogoPlanet } from "@/lib/logo-planet";
import { finePointerQuery, reducedMotionQuery } from "@/lib/media";
import { isSceneHeld, sceneHoldEvent } from "@/lib/scene-hold";
import { globePalette } from "@/lib/theme";
import { isSoftwareRenderer } from "@/lib/webgl";

export interface PlanetsControls {
  dispose: () => void;
}

interface LogoState {
  hotGoal: number;
  inView: boolean;
  motion: LogoMotion;
  node: HTMLElement;
  planet: LogoPlanet;
}

interface Planet {
  group: Group;
  hot: number;
  hotGoal: number;
  moon?: Mesh;
  moonAngle: number;
  node: HTMLElement;
  ringMaterial?: ShaderMaterial;
  speed: number;
  spin: number;
  uniforms: PlanetUniforms;
}

interface PlanetUniforms {
  [uniform: string]: { value: Color | number };
  uColor: { value: Color };
  uHot: { value: number };
  uKind: { value: number };
  uNight: { value: Color };
  uSeed: { value: number };
  uSpin: { value: number };
  uTime: { value: number };
  uWarm: { value: Color };
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
const moonOrbit = 1.56;
const moonSize = 0.2;
const bodyScale = 0.42;
const logoScale = 0.5;
const sunriseVisibility = 0.6;
const frameMs = 1000 / 30;

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

const readColor = (node: HTMLElement): Color => {
  const color = new Color(globePalette.coast);
  const value = getComputedStyle(node).getPropertyValue("--lang").trim();
  if (value.startsWith("#")) color.set(value);
  return color;
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
  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: true,
    canvas,
    powerPreference: "low-power",
  });
  if (isSoftwareRenderer(renderer.getContext())) {
    renderer.dispose();
    throw new Error("software renderer");
  }
  const nodes = [...stage.querySelectorAll<HTMLElement>(".repo-planet")];
  const logoNodes = [...stage.querySelectorAll<HTMLElement>(".logo-planet")];
  if (nodes.length === 0 && logoNodes.length === 0) {
    renderer.dispose();
    throw new Error("no planets");
  }
  renderer.debug.checkShaderErrors = process.env.NODE_ENV !== "production";
  const fine = globalThis.matchMedia(finePointerQuery);
  const reduce = globalThis.matchMedia(reducedMotionQuery);
  let pixelRatio = Math.min(globalThis.devicePixelRatio || 1, maxPixelRatio);
  renderer.setPixelRatio(pixelRatio);
  const scene = new Scene();
  const camera = new OrthographicCamera(0, 1, 0, -1, -400, 400);
  const sphere = new SphereGeometry(1, 40, 28);
  const ring = new RingGeometry(ringInner, ringOuter, 72, 1);
  const materials: ShaderMaterial[] = [];
  const timeUniform = { value: 0 };
  const logos: LogoState[] = [];
  try {
    for (const node of logoNodes) {
      const planet = createLogoPlanet(node, sphere, renderer, timeUniform);
      scene.add(planet.group);
      logos.push({
        hotGoal: 0,
        inView: false,
        motion: createLogoMotion(),
        node,
        planet,
      });
    }
  } catch (error) {
    renderer.dispose();
    throw error;
  }

  const makePlanetMaterial = (
    color: Color,
    kind: number
  ): [ShaderMaterial, PlanetUniforms] => {
    const uniforms: PlanetUniforms = {
      uColor: { value: color },
      uHot: { value: 0 },
      uKind: { value: kind },
      uNight: { value: color.clone().offsetHSL(-0.08, -0.1, -0.32) },
      uSeed: { value: (materials.length * 0.37) % 1 },
      uSpin: { value: 0 },
      uTime: timeUniform,
      uWarm: { value: color.clone().offsetHSL(0.07, 0.18, 0.12) },
    };
    const material = new ShaderMaterial({
      fragmentShader: planetFragment,
      uniforms,
      vertexShader: planetVertex,
    });
    materials.push(material);
    return [material, uniforms];
  };

  const planets: Planet[] = nodes.map((node, index) => {
    const color = readColor(node);
    const kindName = node.dataset["kind"] ?? "ring";
    const kind = kinds.get(kindName) ?? 0;
    const group = new Group();
    group.rotation.z = (-readTilt(node) * Math.PI) / 180;
    const [bodyMaterial, uniforms] = makePlanetMaterial(color, kind);
    group.add(new Mesh(sphere, bodyMaterial));
    const planet: Planet = {
      group,
      hot: 0,
      hotGoal: 0,
      moonAngle: index * 2.1,
      node,
      speed: 0.55 + index * 0.12,
      spin: index * 1.7,
      uniforms,
    };
    if (kindName === "ring") {
      const material = new ShaderMaterial({
        depthWrite: false,
        fragmentShader: ringFragment,
        side: DoubleSide,
        transparent: true,
        uniforms: {
          uColor: { value: color },
          uHot: { value: 0 },
          uInner: { value: ringInner },
          uOuter: { value: ringOuter },
          uTime: timeUniform,
        },
        vertexShader: ringVertex,
      });
      materials.push(material);
      planet.ringMaterial = material;
      const mesh = new Mesh(ring, material);
      mesh.rotation.x = 1.18;
      mesh.rotation.y = -0.28;
      group.add(mesh);
    } else if (kindName === "moon") {
      const [moonMaterial] = makePlanetMaterial(color, 2);
      const moon = new Mesh(sphere, moonMaterial);
      moon.scale.setScalar(moonSize);
      group.add(moon);
      planet.moon = moon;
    }
    scene.add(group);
    return planet;
  });

  let width = 1;
  let height = 1;
  let handle = 0;
  let last = 0;
  let visible = true;
  let frozen = false;
  let lost = false;
  let ready = false;
  let compiled = false;

  const resize = (): void => {
    width = Math.max(1, stage.clientWidth);
    height = Math.max(1, stage.clientHeight);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.left = 0;
    camera.right = width;
    camera.top = 0;
    camera.bottom = -height;
    camera.updateProjectionMatrix();
  };

  const placeAt = (
    group: Group,
    node: HTMLElement,
    scale: number,
    origin: DOMRect
  ): void => {
    const size = node.offsetWidth;
    const box = node.getBoundingClientRect();
    group.visible = size > 0;
    group.position.set(
      box.left - origin.left + box.width / 2,
      -(box.top - origin.top + box.height / 2),
      0
    );
    group.scale.setScalar(size * scale);
  };

  const place = (): void => {
    const origin = stage.getBoundingClientRect();
    for (const planet of planets) {
      placeAt(
        planet.group,
        planet.node,
        bodyScale * (1 + planet.hot * 0.07),
        origin
      );
    }
    for (const logo of logos) {
      placeAt(
        logo.planet.group,
        logo.node,
        logoScale * (1 + logo.motion.hot * 0.07),
        origin
      );
    }
  };

  const draw = (): void => {
    if (!compiled) return;
    place();
    renderer.render(scene, camera);
    if (ready) {
      return;
    }

    ready = true;
    canvas.dataset["ready"] = "";
    stage.dataset["planets"] = "gl";
  };

  const advance = (dt: number): void => {
    const seconds = dt / 1000;
    timeUniform.value += seconds;
    for (const planet of planets) {
      planet.hot += (planet.hotGoal - planet.hot) * (1 - Math.exp(-dt / 140));
      planet.spin += seconds * planet.speed * (1 + planet.hot * 2.4);
      planet.uniforms.uSpin.value = planet.spin;
      planet.uniforms.uHot.value = planet.hot;
      if (planet.ringMaterial) {
        const hot = planet.ringMaterial.uniforms["uHot"];
        if (hot) hot.value = planet.hot;
      }
      if (!planet.moon) {
        continue;
      }

      planet.moonAngle += seconds * (0.95 + planet.hot);
      planet.moon.position.set(
        Math.cos(planet.moonAngle) * moonOrbit,
        Math.sin(planet.moonAngle) * moonOrbit * 0.28,
        Math.sin(planet.moonAngle) * moonOrbit * 0.9
      );
    }
    for (const logo of logos) {
      logo.motion = stepLogoMotion(logo.motion, dt, {
        hotGoal: logo.hotGoal,
        started: logo.inView,
      });
      logo.planet.uniforms.uSpin.value = logoSpin(logo.motion);
      logo.planet.uniforms.uHot.value = logo.motion.hot;
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
    last = 0;
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
    const dt = last > 0 ? Math.min(now - last, 100) : step.dt;
    last = now;
    advance(dt);
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

  const disposers: Array<() => void> = [];
  const listen = (
    target: Document | EventTarget | MediaQueryList | Window,
    type: string,
    listener: EventListener
  ): void => {
    target.addEventListener(type, listener);
    disposers.push(() => target.removeEventListener(type, listener));
  };

  for (const logo of logos) {
    const watcher = new IntersectionObserver(
      (entries) => {
        logo.inView =
          (entries.at(-1)?.intersectionRatio ?? 0) >= sunriseVisibility;
      },
      { threshold: sunriseVisibility }
    );
    watcher.observe(logo.node);
    disposers.push(() => {
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
  void renderer
    .compileAsync(scene, camera)
    .catch(() => undefined)
    .then(() => {
      if (disposed) return;
      compiled = true;
      draw();
      sync();
    });

  return {
    dispose: (): void => {
      disposed = true;
      stop();
      observer.disconnect();
      visibility.disconnect();
      for (const dispose of disposers) dispose();
      sphere.dispose();
      ring.dispose();
      for (const material of materials) material.dispose();
      for (const logo of logos) logo.planet.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      delete canvas.dataset["ready"];
      delete stage.dataset["planets"];
    },
  };
};
