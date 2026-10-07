import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";

import { createFramePacer } from "@/lib/frame-pacer";
import { globeData } from "@/lib/globe-data";
import { reducedMotionQuery } from "@/lib/media";
import { globePalette } from "@/lib/theme";
import { isSoftwareRenderer } from "@/lib/webgl";

export interface GlobeControls {
  dispose: () => void;
  key: (event: KeyboardEvent) => boolean;
  reset: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}
interface GlobeOptions {
  latitude: number;
  longitude: number;
  onInteract: () => void;
  onReady: () => void;
}

type Point = [number, number];

type Project = (lon: number, lat: number) => Point;

interface View {
  lat: number;
  lon: number;
  zoom: number;
}

export class SoftwareRendererError extends Error {
  override name = "SoftwareRendererError";
}

const deg = Math.PI / 180;
const fov = 30;
const fitRatio = 0.86;
const minZoom = 1;
const maxZoom = 9;
const homeZoom = 2;
const maxLatitude = 80;
const worldWidth = 2048;
const worldHeight = 1024;
const europePixelsPerDegree = 32;
const europeFadeStart = 1.4;
const europeFadeEnd = 1.9;
const maskPixelsPerDegree = 12;
const homeTau = 380;
const pulseSeconds = 2.2;
const pulseRunMs = 6600;
const maxPixelRatio = 1.75;

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

const wrap180 = (value: number): number =>
  ((((value + 180) % 360) + 360) % 360) - 180;

const smoothstep = (low: number, high: number, value: number): number => {
  const t = clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
};

const unzigzag = (value: number): number => (value >>> 1) ^ -(value & 1);

const decode = (text: string, step: number): Point[] => {
  const numbers = text.split(",").map((part) => Number.parseInt(part, 36));
  const points: Point[] = [];
  let x = 0;
  let y = 0;
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    x += unzigzag(numbers[index] ?? 0);
    y += unzigzag(numbers[index + 1] ?? 0);
    points.push([x / step, y / step]);
  }
  return points;
};

const vectorOf = (lon: number, lat: number): Vector3 =>
  new Vector3(
    Math.cos(lat * deg) * Math.sin(lon * deg),
    Math.sin(lat * deg),
    Math.cos(lat * deg) * Math.cos(lon * deg)
  );

const createCanvas = (
  width: number,
  height: number
): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2d canvas unavailable");
  return [canvas, context];
};

const traceRings = (
  context: CanvasRenderingContext2D,
  rings: string[],
  step: number,
  project: Project,
  close: boolean
): void => {
  context.beginPath();
  for (const text of rings) {
    const points = decode(text, step);
    for (const [index, [lon, lat]] of points.entries()) {
      const [x, y] = project(lon, lat);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    if (close) context.closePath();
  }
};

const drawWorld = (): HTMLCanvasElement => {
  const [canvas, context] = createCanvas(worldWidth, worldHeight);
  const { world } = globeData;
  const project: Project = (lon, lat) => [
    ((lon + 180) / 360) * worldWidth,
    ((90 - lat) / 180) * worldHeight,
  ];
  context.fillStyle = globePalette.ocean;
  context.fillRect(0, 0, worldWidth, worldHeight);
  context.strokeStyle = globePalette.graticule;
  context.globalAlpha = 0.09;
  context.lineWidth = 1;
  context.beginPath();
  for (let lon = -180; lon <= 180; lon += 15) {
    const [x] = project(lon, 0);
    context.moveTo(x, 0);
    context.lineTo(x, worldHeight);
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    const [, y] = project(0, lat);
    context.moveTo(0, y);
    context.lineTo(worldWidth, y);
  }
  context.stroke();
  context.globalAlpha = 1;
  traceRings(context, world.land, world.step, project, true);
  context.fillStyle = globePalette.land;
  context.fill("evenodd");
  context.strokeStyle = globePalette.coast;
  context.globalAlpha = 0.7;
  context.lineWidth = 1.6;
  context.stroke();
  context.globalAlpha = 1;
  traceRings(context, world.austria, world.step, project, true);
  context.fillStyle = globePalette.austria;
  context.fill("evenodd");
  return canvas;
};

const feather = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number
): void => {
  const edge = 0.1;
  context.globalCompositeOperation = "destination-in";
  const horizontal = context.createLinearGradient(0, 0, width, 0);
  horizontal.addColorStop(0, "rgba(0,0,0,0)");
  horizontal.addColorStop(edge, "rgba(0,0,0,1)");
  horizontal.addColorStop(1 - edge, "rgba(0,0,0,1)");
  horizontal.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = horizontal;
  context.fillRect(0, 0, width, height);
  const vertical = context.createLinearGradient(0, 0, 0, height);
  vertical.addColorStop(0, "rgba(0,0,0,0)");
  vertical.addColorStop(edge, "rgba(0,0,0,1)");
  vertical.addColorStop(1 - edge, "rgba(0,0,0,1)");
  vertical.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = vertical;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = "source-over";
};

const drawEurope = (): HTMLCanvasElement => {
  const { east, north, south, west } = globeData.europe.bounds;
  const width = Math.round((east - west) * europePixelsPerDegree);
  const height = Math.round((north - south) * europePixelsPerDegree);
  const [canvas, context] = createCanvas(width, height);
  const { europe } = globeData;
  const project: Project = (lon, lat) => [
    (lon - west) * europePixelsPerDegree,
    (north - lat) * europePixelsPerDegree,
  ];
  context.fillStyle = globePalette.ocean;
  context.fillRect(0, 0, width, height);
  context.lineJoin = "round";
  traceRings(context, europe.land, europe.step, project, true);
  context.fillStyle = globePalette.land;
  context.fill("evenodd");
  traceRings(context, europe.austria, europe.step, project, true);
  context.fillStyle = globePalette.austria;
  context.fill("evenodd");
  traceRings(context, europe.land, europe.step, project, true);
  context.strokeStyle = globePalette.coast;
  context.globalAlpha = 0.8;
  context.lineWidth = 1.8;
  context.stroke();
  traceRings(context, europe.borders, europe.step, project, false);
  context.strokeStyle = globePalette.border;
  context.globalAlpha = 1;
  context.lineWidth = 1.3;
  context.stroke();
  traceRings(context, europe.austria, europe.step, project, true);
  context.strokeStyle = globePalette.graticule;
  context.globalAlpha = 0.9;
  context.lineWidth = 2.2;
  context.stroke();
  context.globalAlpha = 1;
  feather(context, width, height);
  return canvas;
};

let worldCache: HTMLCanvasElement | undefined;
let europeCache: HTMLCanvasElement | undefined;

const worldCanvas = (): HTMLCanvasElement => {
  worldCache ??= drawWorld();
  return worldCache;
};

let maskCache: HTMLCanvasElement | undefined;

const drawMask = (): HTMLCanvasElement => {
  const { east, north, south, west } = globeData.europe.bounds;
  const width = Math.round((east - west) * maskPixelsPerDegree);
  const height = Math.round((north - south) * maskPixelsPerDegree);
  const [canvas, context] = createCanvas(width, height);
  const { europe } = globeData;
  const project: Project = (lon, lat) => [
    (lon - west) * maskPixelsPerDegree,
    (north - lat) * maskPixelsPerDegree,
  ];
  context.fillStyle = "rgb(0,0,0)";
  context.fillRect(0, 0, width, height);
  traceRings(context, europe.austria, europe.step, project, true);
  context.shadowColor = "rgb(255,255,255)";
  context.shadowBlur = 14;
  context.fillStyle = "rgb(110,110,110)";
  context.fill("evenodd");
  context.shadowBlur = 0;
  context.fillStyle = "rgb(255,255,255)";
  context.fill("evenodd");
  return canvas;
};

const maskCanvas = (): HTMLCanvasElement => {
  maskCache ??= drawMask();
  return maskCache;
};

const europeCanvas = (): HTMLCanvasElement => {
  europeCache ??= drawEurope();
  return europeCache;
};

const patchGeometry = (
  west: number,
  east: number,
  south: number,
  north: number,
  columns: number,
  rows: number,
  radius: number
): BufferGeometry => {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row += 1) {
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns;
      const v = row / rows;
      const unit = vectorOf(
        west + (east - west) * u,
        south + (north - south) * v
      );
      positions.push(unit.x * radius, unit.y * radius, unit.z * radius);
      normals.push(unit.x, unit.y, unit.z);
      uvs.push(u, v);
    }
  }
  const stride = columns + 1;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * stride + column;
      const c = a + stride;
      indices.push(a, a + 1, c + 1, a, c + 1, c);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3)
  );
  geometry.setAttribute(
    "normal",
    new BufferAttribute(new Float32Array(normals), 3)
  );
  geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  return geometry;
};

const surfaceVertex = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vUv = uv;
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-viewPosition.xyz);
  gl_Position = projectionMatrix * viewPosition;
}
`;

const surfaceFragment = `
uniform sampler2D map;
uniform float opacity;
uniform vec3 rim;
uniform vec3 sheen;
uniform float pulse;
#ifdef USE_MASK
uniform sampler2D mask;
uniform vec3 highlight;
#endif
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vView;
const vec3 sun = vec3(-0.42, 0.52, 0.74);
void main() {
  vec4 texel = texture2D(map, vUv);
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vView);
  float facing = clamp(dot(n, v), 0.0, 1.0);
  float lit = dot(n, normalize(sun)) * 0.5 + 0.5;
  float gain = 0.95 + 0.55 * smoothstep(0.12, 1.0, lit);
  float edge = pow(1.0 - facing, 2.4);
  float shine = max(dot(reflect(-normalize(sun), n), v), 0.0);
  float luma = dot(texel.rgb, vec3(0.2126, 0.7152, 0.0722));
  float water = 1.0 - smoothstep(0.02, 0.06, luma);
  float gloss = water * (pow(shine, 220.0) * 0.55 + pow(shine, 28.0) * 0.07)
    + (1.0 - water) * pow(shine, 22.0) * 0.12;
  vec3 color = texel.rgb * gain + rim * edge * 0.85 + sheen * gloss;
  #ifdef USE_MASK
  float m = texture2D(mask, vUv).r;
  float core = smoothstep(0.75, 1.0, m);
  color += highlight * m * (0.32 + 0.2 * pulse);
  color += sheen * core * (pow(shine, 14.0) * 0.6 + 0.08);
  #endif
  gl_FragColor = vec4(color, texel.a * opacity);
  #include <colorspace_fragment>
}
`;

const glowVertex = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const glowFragment = `
uniform vec3 glow;
uniform float pulse;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float core = smoothstep(0.32, 0.0, d);
  float halo = pow(max(1.0 - d, 0.0), 2.2);
  float alpha = core * 0.9 + halo * (0.45 + 0.25 * pulse);
  gl_FragColor = vec4(glow * alpha * 1.4, alpha);
  #include <colorspace_fragment>
}
`;

const haloVertex = `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-viewPosition.xyz);
  gl_Position = projectionMatrix * viewPosition;
}
`;

const haloFragment = `
uniform vec3 glow;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float facing = abs(dot(vNormal, vView));
  float strength = pow(smoothstep(0.0, 0.5, facing), 1.5);
  gl_FragColor = vec4(glow * strength * 1.25, strength);
  #include <colorspace_fragment>
}
`;

export const createCityGlobe = (
  canvas: HTMLCanvasElement,
  options: GlobeOptions
): GlobeControls => {
  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: true,
    canvas,
    powerPreference: "low-power",
  });
  if (isSoftwareRenderer(renderer.getContext())) {
    renderer.dispose();
    throw new SoftwareRendererError("software renderer");
  }
  renderer.debug.checkShaderErrors = process.env.NODE_ENV !== "production";
  const reduce = globalThis.matchMedia(reducedMotionQuery);
  let pixelRatio = Math.min(globalThis.devicePixelRatio || 1, maxPixelRatio);
  renderer.setPixelRatio(pixelRatio);
  const scene = new Scene();
  const camera = new PerspectiveCamera(fov, 1, 0.05, 20);
  const globe = new Group();
  scene.add(globe);

  const anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const textures: CanvasTexture[] = [];
  const makeTexture = (source: HTMLCanvasElement): CanvasTexture => {
    const texture = new CanvasTexture(source);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = anisotropy;
    texture.minFilter = LinearMipmapLinearFilter;
    textures.push(texture);
    return texture;
  };

  const rimColor = new Color(globePalette.rim);
  const sheenColor = new Color(globePalette.sheen);
  const pulseUniform = { value: 0 };
  const surface = (
    map: CanvasTexture,
    transparent: boolean,
    opacity: { value: number },
    mask?: CanvasTexture
  ): ShaderMaterial =>
    new ShaderMaterial({
      defines: mask ? { USE_MASK: "" } : {},
      depthWrite: !transparent,
      fragmentShader: surfaceFragment,
      polygonOffset: transparent,
      polygonOffsetFactor: transparent ? -2 : 0,
      transparent,
      uniforms: {
        map: { value: map },
        opacity,
        pulse: pulseUniform,
        ...(mask && {
          highlight: { value: new Color(globePalette.austria) },
          mask: { value: mask },
        }),
        rim: { value: rimColor },
        sheen: { value: sheenColor },
      },
      vertexShader: surfaceVertex,
    });

  const baseMaterial = surface(makeTexture(worldCanvas()), false, {
    value: 1,
  });
  const baseGeometry = patchGeometry(-180, 180, -90, 90, 96, 48, 1);
  globe.add(new Mesh(baseGeometry, baseMaterial));

  const { east, north, south, west } = globeData.europe.bounds;
  const europeGeometry = patchGeometry(
    west,
    east,
    south,
    north,
    64,
    40,
    1.0012
  );
  const europeOpacity = { value: 0 };
  const europeMaterial = surface(
    makeTexture(europeCanvas()),
    true,
    europeOpacity,
    makeTexture(maskCanvas())
  );
  const europe = new Mesh(europeGeometry, europeMaterial);
  europe.visible = false;
  globe.add(europe);

  const haloMaterial = new ShaderMaterial({
    blending: AdditiveBlending,
    depthWrite: false,
    fragmentShader: haloFragment,
    side: BackSide,
    transparent: true,
    uniforms: { glow: { value: rimColor } },
    vertexShader: haloVertex,
  });
  const haloGeometry = new SphereGeometry(1.16, 40, 28);
  scene.add(new Mesh(haloGeometry, haloMaterial));

  const marker = new Group();
  const markerNormal = vectorOf(options.longitude, options.latitude);
  marker.position.copy(markerNormal).multiplyScalar(1.004);
  marker.quaternion.copy(
    new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), markerNormal)
  );
  const dotGeometry = new SphereGeometry(0.012, 14, 10);
  const dotMaterial = new MeshBasicMaterial({ color: globePalette.marker });
  marker.add(new Mesh(dotGeometry, dotMaterial));
  const glowGeometry = new PlaneGeometry(0.16, 0.16);
  const glowMaterial = new ShaderMaterial({
    blending: AdditiveBlending,
    depthWrite: false,
    fragmentShader: glowFragment,
    transparent: true,
    uniforms: {
      glow: { value: new Color(globePalette.marker) },
      pulse: pulseUniform,
    },
    vertexShader: glowVertex,
  });
  const glow = new Mesh(glowGeometry, glowMaterial);
  glow.position.z = 0.002;
  marker.add(glow);
  const ringGeometry = new RingGeometry(0.018, 0.0235, 40);
  const rings = [0, 0.5].map((phase) => {
    const material = new MeshBasicMaterial({
      color: globePalette.marker,
      depthWrite: false,
      opacity: 0.9,
      side: DoubleSide,
      transparent: true,
    });
    const mesh = new Mesh(ringGeometry, material);
    marker.add(mesh);
    return { material, mesh, phase };
  });
  globe.add(marker);

  const home: View = {
    lat: options.latitude,
    lon: options.longitude,
    zoom: homeZoom,
  };
  const view: View = reduce.matches
    ? { ...home }
    : { lat: 14, lon: wrap180(home.lon + 105), zoom: 1.1 };
  const goal: View = { ...home };
  let height = 1;
  let baseDistance = 4;
  let tau = homeTau;
  let dragging = false;
  let velocity: Point = [0, 0];
  let pulseClock = 0;
  let pulseUntil = performance.now() + pulseRunMs;
  let touched = false;
  let disposed = false;
  let frozen = false;
  let compiled = false;
  let handle = 0;
  let lastDraw = 0;

  const distance = (): number => 1 + (baseDistance - 1) / view.zoom;

  const paintRings = (): void => {
    const live = !reduce.matches && performance.now() < pulseUntil;
    for (const ring of rings) {
      const phase = live ? (pulseClock / pulseSeconds + ring.phase) % 1 : 0.45;
      ring.mesh.scale.setScalar(1 + phase * 2.6);
      ring.material.opacity = live ? 0.95 * (1 - phase) ** 1.5 : 0.7;
    }
  };

  const apply = (): void => {
    globe.rotation.set(view.lat * deg, -view.lon * deg, 0);
    const d = distance();
    camera.position.set(0, 0, d);
    const fade = smoothstep(europeFadeStart, europeFadeEnd, view.zoom);
    europeOpacity.value = fade;
    europe.visible = fade > 0.01;
    marker.scale.setScalar(clamp((d - 1) / (baseDistance - 1), 0.18, 1));
    paintRings();
  };

  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const fit = Math.tan((fov * deg) / 2) * Math.min(1, camera.aspect);
    baseDistance = Math.sqrt(1 + (1 / (fitRatio * fit)) ** 2);
  };

  const pacer = createFramePacer({
    activeFrameMs: 1000 / 60,
    canDowngrade: () => pixelRatio > 1,
    downgrade: () => {
      pixelRatio = 1;
      resize();
    },
  });

  const render = (): void => {
    if (!compiled) return;
    apply();
    renderer.render(scene, camera);
  };

  const pointers = new Map<number, Point>();

  const settled = (): boolean =>
    !dragging &&
    pointers.size === 0 &&
    Math.hypot(velocity[0], velocity[1]) < 0.002 &&
    Math.abs(wrap180(goal.lon - view.lon)) < 0.02 &&
    Math.abs(goal.lat - view.lat) < 0.02 &&
    Math.abs(goal.zoom / view.zoom - 1) < 0.002;

  const update = (dt: number): void => {
    const follow = reduce.matches ? 1 : 1 - Math.exp(-dt / tau);
    if (!dragging) {
      const speed = Math.hypot(velocity[0], velocity[1]);
      if (speed > 0.002 && !reduce.matches) {
        goal.lon = wrap180(goal.lon + velocity[0] * dt);
        goal.lat = clamp(
          goal.lat + velocity[1] * dt,
          -maxLatitude,
          maxLatitude
        );
        view.lon = goal.lon;
        view.lat = goal.lat;
        const decay = Math.exp(-dt / 320);
        velocity = [velocity[0] * decay, velocity[1] * decay];
      } else {
        velocity = [0, 0];
        view.lon = wrap180(view.lon + wrap180(goal.lon - view.lon) * follow);
        view.lat += (goal.lat - view.lat) * follow;
      }
      view.zoom *= (goal.zoom / view.zoom) ** follow;
    }
    pulseClock += dt / 1000;
    pulseUniform.value = reduce.matches
      ? 0.5
      : 0.5 + 0.5 * Math.sin((pulseClock / pulseSeconds) * Math.PI * 2);
  };

  const schedule = (): void => {
    if (disposed || handle !== 0 || document.hidden) return;
    handle = requestAnimationFrame(tick);
  };

  const tick = (now: number): void => {
    handle = 0;
    if (disposed) return;
    const step = pacer.step(now);
    if (step.kind !== "draw") {
      if (step.kind === "freeze") {
        frozen = true;
        Object.assign(view, goal);
        velocity = [0, 0];
        render();
      } else {
        schedule();
      }
      return;
    }
    const elapsed = lastDraw > 0 ? clamp(now - lastDraw, 1, 800) : step.dt;
    lastDraw = now;
    update(elapsed);
    render();
    if (!settled() || now < pulseUntil) schedule();
    else lastDraw = 0;
  };

  const wake = (): void => {
    if (frozen) {
      frozen = false;
      lastDraw = 0;
      pacer.reset();
    }
    pacer.markActive();
    schedule();
  };

  const interact = (): void => {
    if (!touched) {
      touched = true;
      options.onInteract();
    }
    tau = 150;
    wake();
  };

  const degreesPerPixel = (): number =>
    (2 * Math.tan((fov * deg) / 2) * (distance() - 1)) / height / deg;

  const rotateBy = (dx: number, dy: number): void => {
    const scale = degreesPerPixel();
    goal.lon = wrap180(goal.lon - dx * scale);
    goal.lat = clamp(goal.lat + dy * scale, -maxLatitude, maxLatitude);
    view.lon = goal.lon;
    view.lat = goal.lat;
  };

  const zoomTo = (zoom: number, instant: boolean): void => {
    goal.zoom = clamp(zoom, minZoom, maxZoom);
    if (instant) view.zoom = goal.zoom;
  };

  let pinch = 0;
  let lastMove = 0;

  const span = (): number => {
    const [a, b] = pointers.values().toArray();
    return Math.hypot(
      (a?.[0] ?? 0) - (b?.[0] ?? 0),
      (a?.[1] ?? 0) - (b?.[1] ?? 0)
    );
  };

  const onDown = (event: PointerEvent): void => {
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, [event.clientX, event.clientY]);
    dragging = true;
    velocity = [0, 0];
    lastMove = event.timeStamp;
    if (pointers.size === 2) pinch = span();
    interact();
  };

  const onMove = (event: PointerEvent): void => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const next: Point = [event.clientX, event.clientY];
    pointers.set(event.pointerId, next);
    if (pointers.size >= 2) {
      const now = span();
      if (pinch > 0 && now > 0) zoomTo(goal.zoom * (now / pinch), true);
      pinch = now;
    } else {
      const dx = next[0] - previous[0];
      const dy = next[1] - previous[1];
      rotateBy(dx, dy);
      const dt = Math.max(1, event.timeStamp - lastMove);
      const scale = degreesPerPixel();
      velocity = [
        velocity[0] * 0.6 + ((-dx * scale) / dt) * 0.4,
        velocity[1] * 0.6 + ((dy * scale) / dt) * 0.4,
      ];
      lastMove = event.timeStamp;
    }
    interact();
  };

  const onUp = (event: PointerEvent): void => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = 0;
    if (pointers.size === 0) {
      dragging = false;
      if (event.timeStamp - lastMove > 90) velocity = [0, 0];
    }
    wake();
  };

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const rate = event.ctrlKey ? 0.01 : 0.0016;
    zoomTo(goal.zoom * Math.exp(-event.deltaY * rate), true);
    interact();
  };

  const onLost = (event: Event): void => {
    event.preventDefault();
    disposed = true;
    canvas.dataset["globeState"] = "lost";
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("webglcontextlost", onLost);

  const observer = new ResizeObserver(() => {
    resize();
    wake();
  });
  observer.observe(canvas);

  const onVisibility = (): void => {
    if (document.hidden) {
      if (handle !== 0) cancelAnimationFrame(handle);
      handle = 0;
    } else {
      pacer.reset();
      lastDraw = 0;
      wake();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  resize();
  void renderer
    .compileAsync(scene, camera)
    .catch(() => undefined)
    .then(() => {
      if (disposed) return;
      compiled = true;
      render();
      wake();
      options.onReady();
    });

  const go = (action: () => void): void => {
    action();
    tau = 220;
    pulseUntil = performance.now() + pulseRunMs;
    interact();
  };

  return {
    dispose: (): void => {
      disposed = true;
      if (handle !== 0) cancelAnimationFrame(handle);
      handle = 0;
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("webglcontextlost", onLost);
      for (const texture of textures) texture.dispose();
      for (const geometry of [
        baseGeometry,
        europeGeometry,
        haloGeometry,
        dotGeometry,
        ringGeometry,
        glowGeometry,
      ]) {
        geometry.dispose();
      }
      baseMaterial.dispose();
      europeMaterial.dispose();
      haloMaterial.dispose();
      dotMaterial.dispose();
      glowMaterial.dispose();
      for (const ring of rings) ring.material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
    key: (event: KeyboardEvent): boolean => {
      if (event.altKey || event.ctrlKey || event.metaKey) return false;
      const turn = 12 / Math.sqrt(goal.zoom);
      switch (event.key) {
        case "0":
        case "Home": {
          go(() => {
            Object.assign(goal, home);
          });
          return true;
        }
        case "+":
        case "=": {
          go(() => {
            zoomTo(goal.zoom * 1.5, false);
          });
          return true;
        }
        case "-":
        case "_": {
          go(() => {
            zoomTo(goal.zoom / 1.5, false);
          });
          return true;
        }
        case "ArrowDown": {
          go(() => {
            goal.lat = clamp(goal.lat - turn, -maxLatitude, maxLatitude);
          });
          return true;
        }
        case "ArrowLeft": {
          go(() => {
            goal.lon = wrap180(goal.lon - turn);
          });
          return true;
        }
        case "ArrowRight": {
          go(() => {
            goal.lon = wrap180(goal.lon + turn);
          });
          return true;
        }
        case "ArrowUp": {
          go(() => {
            goal.lat = clamp(goal.lat + turn, -maxLatitude, maxLatitude);
          });
          return true;
        }
        default: {
          return false;
        }
      }
    },
    reset: (): void => {
      go(() => {
        Object.assign(goal, home);
      });
    },
    zoomIn: (): void => {
      go(() => {
        zoomTo(goal.zoom * 1.6, false);
      });
    },
    zoomOut: (): void => {
      go(() => {
        zoomTo(goal.zoom / 1.6, false);
      });
    },
  };
};
