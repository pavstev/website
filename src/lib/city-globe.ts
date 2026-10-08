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
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from "three";

import { createFramePacer } from "@/lib/frame-pacer";
import { globeData } from "@/lib/globe-data";
import {
  type LabelAnchor,
  type LabelRect,
  type LabelSide,
  type PlacedLabel,
  placeLabels,
} from "@/lib/globe-labels";
import { stillQuery } from "@/lib/motion-pause";
import { subsolarPoint } from "@/lib/sun";
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
  avoid: readonly HTMLElement[];
  cities: readonly GlobePlace[];
  home: GlobePoint;
  homeLabel: HTMLElement;
  labels: HTMLElement;
  onInteract: () => void;
  onReady: () => void;
}

interface GlobePlace extends GlobePoint {
  name: string;
}

interface GlobePoint {
  latitude: number;
  longitude: number;
}

interface Label {
  element: HTMLElement;
  height: number;
  key: string;
  offset: number;
  position: Vector3;
  radius: number;
  shown: string;
  width: number;
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
const homeZoom = 3.2;
const maxLatitude = 80;
const worldWidth = 2048;
const worldHeight = 1024;
const europePixelsPerDegree = 32;
const europeFadeStart = 1.4;
const europeFadeEnd = 1.9;
const homeTau = 300;
const introLongitude = 42;
const introLatitude = 16;
const introZoom = 1.3;
const tiltStart = 1.3;
const tiltEnd = 3.4;
const maxTilt = 26;
const sunRefreshMs = 60_000;
const markerRadius = 1.003;
const citySize = 9;
const beaconSize = 60;
const pillarReach = 0.36;
const pillarHalfWidth = 7;
const labelGap = 3;
const labelFacing = 0.15;
const homeMark = { offset: 14, radius: 7 };
const cityMark = { offset: 6, radius: 3 };
const maxPixelRatio = 1.75;

const maskColors = {
  austria: "rgb(255,255,0)",
  land: "rgb(255,0,0)",
  none: "rgb(0,0,0)",
} as const;

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

const unwrap = (points: Point[]): Point[] => {
  let shift = 0;
  let previous: number | undefined;
  return points.map(([lon, lat]) => {
    if (previous !== undefined) {
      const jump = lon + shift - previous;
      if (jump > 180) shift -= 360;
      else if (jump < -180) shift += 360;
    }
    previous = lon + shift;
    return [previous, lat];
  });
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

const fillRings = (
  context: CanvasRenderingContext2D,
  rings: string[],
  step: number,
  project: Project,
  offsets: readonly number[],
  color: string
): void => {
  context.beginPath();
  for (const text of rings) {
    const points = unwrap(decode(text, step));
    for (const offset of offsets) {
      for (const [index, [lon, lat]] of points.entries()) {
        const [x, y] = project(lon + offset, lat);
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
    }
  }
  context.fillStyle = color;
  context.fill("evenodd");
};

const drawWorldMask = (): HTMLCanvasElement => {
  const [canvas, context] = createCanvas(worldWidth, worldHeight);
  const { world } = globeData;
  const project: Project = (lon, lat) => [
    ((lon + 180) / 360) * worldWidth,
    ((90 - lat) / 180) * worldHeight,
  ];
  const offsets = [-360, 0, 360];
  context.fillStyle = maskColors.none;
  context.fillRect(0, 0, worldWidth, worldHeight);
  fillRings(context, world.land, world.step, project, offsets, maskColors.land);
  fillRings(
    context,
    world.austria,
    world.step,
    project,
    offsets,
    maskColors.austria
  );
  return canvas;
};

const drawEuropeMask = (): HTMLCanvasElement => {
  const { east, north, south, west } = globeData.europe.bounds;
  const width = Math.round((east - west) * europePixelsPerDegree);
  const height = Math.round((north - south) * europePixelsPerDegree);
  const [canvas, context] = createCanvas(width, height);
  const { europe } = globeData;
  const project: Project = (lon, lat) => [
    (lon - west) * europePixelsPerDegree,
    (north - lat) * europePixelsPerDegree,
  ];
  context.fillStyle = maskColors.none;
  context.fillRect(0, 0, width, height);
  fillRings(context, europe.land, europe.step, project, [0], maskColors.land);
  fillRings(
    context,
    europe.austria,
    europe.step,
    project,
    [0],
    maskColors.austria
  );
  return canvas;
};

let worldCache: HTMLCanvasElement | undefined;
let europeCache: HTMLCanvasElement | undefined;

const worldMask = (): HTMLCanvasElement => {
  worldCache ??= drawWorldMask();
  return worldCache;
};

const europeMask = (): HTMLCanvasElement => {
  europeCache ??= drawEuropeMask();
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

const attribute = (values: number[], size: number): BufferAttribute =>
  new BufferAttribute(new Float32Array(values), size);

const surfaceVertex = `
varying vec2 vUv;
varying vec3 vSurface;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vUv = uv;
  vSurface = normal;
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-viewPosition.xyz);
  gl_Position = projectionMatrix * viewPosition;
}
`;

const surfaceFragment = `
uniform sampler2D mask;
uniform vec3 sun;
uniform float opacity;
uniform vec3 dayOcean;
uniform vec3 dayLand;
uniform vec3 nightOcean;
uniform vec3 nightLand;
uniform vec3 austria;
uniform vec3 coast;
uniform vec3 twilight;
uniform vec3 sunlight;
uniform vec3 rim;
varying vec2 vUv;
varying vec3 vSurface;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec4 texel = texture2D(mask, vUv);
  float aa = max(fwidth(texel.r), 0.0005);
  float land = smoothstep(0.5 - aa, 0.5 + aa, texel.r);
  float home = smoothstep(0.5 - aa, 0.5 + aa, texel.g);
  float shore = clamp(1.0 - abs(texel.r - 0.5) / (aa * 1.2), 0.0, 1.0);
  float height = dot(normalize(vSurface), sun);
  float day = smoothstep(-0.12, 0.16, height);
  vec3 color = mix(
    mix(nightOcean, nightLand, land),
    mix(dayOcean, dayLand, land),
    day
  );
  color = mix(color, austria, home * (0.1 + 0.28 * day));
  color = mix(color, coast, shore * (0.05 + 0.17 * day));
  color += twilight * exp(-pow(height / 0.09, 2.0)) * 0.06;
  color += sunlight * pow(max(height, 0.0), 2.0) * 0.025 * (0.4 + 0.6 * land);
  float facing = clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0);
  float edgeLight = smoothstep(-0.25, 0.65, height);
  color += rim * pow(1.0 - facing, 3.0) * (0.005 + 0.1 * edgeLight);
  #ifdef PATCH
  vec2 edge = smoothstep(vec2(0.0), vec2(0.08), vUv)
    * smoothstep(vec2(0.0), vec2(0.08), 1.0 - vUv);
  gl_FragColor = vec4(color, opacity * edge.x * edge.y);
  #else
  gl_FragColor = vec4(color, 1.0);
  #endif
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
uniform vec3 sun;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float facing = abs(dot(vNormal, vView));
  float strength = pow(smoothstep(0.0, 0.5, facing), 1.5);
  float lit = smoothstep(-0.35, 0.65, dot(normalize(vNormal), sun));
  float alpha = strength * lit * 0.1;
  gl_FragColor = vec4(glow * alpha, alpha);
  #include <colorspace_fragment>
}
`;

const pointVertex = `
uniform float pixelRatio;
uniform float size;
varying float vFacing;
void main() {
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  vec3 n = normalize(normalMatrix * normalize(position));
  vFacing = smoothstep(0.0, 0.3, dot(n, normalize(-viewPosition.xyz)));
  gl_PointSize = size * pixelRatio;
  gl_Position = projectionMatrix * viewPosition;
}
`;

const cityFragment = `
uniform vec3 color;
varying float vFacing;
void main() {
  float r = length(gl_PointCoord * 2.0 - 1.0);
  float body = 1.0 - smoothstep(0.3, 0.48, r);
  float glow = (1.0 - smoothstep(0.4, 1.0, r)) * 0.22;
  gl_FragColor = vec4(color, max(body, glow) * vFacing);
  #include <colorspace_fragment>
}
`;

const beaconFragment = `
uniform float time;
uniform float motion;
uniform vec3 color;
uniform vec3 core;
varying float vFacing;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r = length(p);
  float radius = 0.17;
  float body = 1.0 - smoothstep(radius - 0.05, radius, r);
  float light = clamp(1.0 - length(p / radius + vec2(0.35)), 0.0, 1.0);
  float glow = exp(-pow(r / 0.38, 2.0)) * 0.5;
  float t = motion > 0.5 ? fract(time / 3.4) : 0.42;
  float spread = radius + t * (0.95 - radius);
  float ring = 1.0 - smoothstep(0.0, 0.08, abs(r - spread));
  float fade = motion > 0.5 ? pow(1.0 - t, 1.2) * 0.9 : 0.6;
  vec3 tint = mix(color, core, body * (0.4 + 0.6 * light));
  float alpha = max(max(body, glow), ring * fade) * vFacing;
  gl_FragColor = vec4(tint, alpha);
  #include <colorspace_fragment>
}
`;

const pillarVertex = `
uniform float viewHeight;
uniform float reach;
uniform float halfWidth;
attribute vec2 corner;
varying vec2 vCorner;
varying float vStrength;
void main() {
  vec3 base = (modelViewMatrix * vec4(position, 1.0)).xyz;
  vec3 axis = normalize(normalMatrix * normalize(position));
  vec3 toEye = normalize(-base);
  vec3 across = cross(axis, toEye);
  float side = length(across);
  across = side > 0.0001 ? across / side : vec3(1.0, 0.0, 0.0);
  vec3 point = base + axis * (corner.y * reach);
  float perPixel = 2.0 * max(-point.z, 0.001) / (projectionMatrix[1][1] * viewHeight);
  point += across * (corner.x * halfWidth * perPixel);
  vCorner = corner;
  vStrength = smoothstep(0.04, 0.22, side) * smoothstep(-0.12, 0.18, dot(axis, toEye));
  gl_Position = projectionMatrix * vec4(point, 1.0);
}
`;

const pillarFragment = `
uniform float time;
uniform float motion;
uniform vec3 color;
varying vec2 vCorner;
varying float vStrength;
void main() {
  float x = abs(vCorner.x);
  float rise = vCorner.y;
  float beam = exp(-pow(x / 0.16, 2.0)) + exp(-pow(x / 0.55, 2.0)) * 0.3;
  float fade = pow(1.0 - rise, 1.8) * smoothstep(0.0, 0.05, rise);
  float wave = motion > 0.5 ? exp(-pow((rise - fract(time / 2.8)) / 0.09, 2.0)) * 0.55 : 0.0;
  gl_FragColor = vec4(color, beam * fade * (0.8 + wave) * vStrength);
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
  const reduce = stillQuery();
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
    texture.anisotropy = anisotropy;
    texture.minFilter = LinearMipmapLinearFilter;
    textures.push(texture);
    return texture;
  };

  const sunObject = new Vector3(0, 0, 1);
  const sunView = new Vector3(0, 0, 1);
  const palette = {
    austria: { value: new Color(globePalette.austria) },
    coast: { value: new Color(globePalette.coast) },
    dayLand: { value: new Color(globePalette.dayLand) },
    dayOcean: { value: new Color(globePalette.dayOcean) },
    nightLand: { value: new Color(globePalette.nightLand) },
    nightOcean: { value: new Color(globePalette.nightOcean) },
    rim: { value: new Color(globePalette.rim) },
    sun: { value: sunObject },
    sunlight: { value: new Color(globePalette.sunlight) },
    twilight: { value: new Color(globePalette.twilight) },
  };
  const surface = (
    mask: CanvasTexture,
    opacity: undefined | { value: number }
  ): ShaderMaterial =>
    new ShaderMaterial({
      defines: opacity ? { PATCH: "" } : {},
      depthWrite: !opacity,
      fragmentShader: surfaceFragment,
      polygonOffset: Boolean(opacity),
      polygonOffsetFactor: opacity ? -2 : 0,
      transparent: Boolean(opacity),
      uniforms: {
        ...palette,
        mask: { value: mask },
        opacity: opacity ?? { value: 1 },
      },
      vertexShader: surfaceVertex,
    });

  const baseMaterial = surface(makeTexture(worldMask()), undefined);
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
  const europeMaterial = surface(makeTexture(europeMask()), europeOpacity);
  const europe = new Mesh(europeGeometry, europeMaterial);
  europe.visible = false;
  globe.add(europe);

  const haloMaterial = new ShaderMaterial({
    blending: AdditiveBlending,
    depthWrite: false,
    fragmentShader: haloFragment,
    side: BackSide,
    transparent: true,
    uniforms: {
      glow: { value: new Color(globePalette.rim) },
      sun: { value: sunView },
    },
    vertexShader: haloVertex,
  });
  const haloGeometry = new SphereGeometry(1.16, 40, 28);
  scene.add(new Mesh(haloGeometry, haloMaterial));

  const pointAt = (place: GlobePoint): Vector3 =>
    vectorOf(place.longitude, place.latitude).multiplyScalar(markerRadius);
  const homePosition = pointAt(options.home);
  const cityPositions = options.cities.map((city) => pointAt(city));
  const timeUniform = { value: 0 };
  const motionUniform = { value: reduce.matches ? 0 : 1 };
  const pixelRatioUniform = { value: pixelRatio };
  const viewHeightUniform = { value: 1 };
  const goldUniform = { value: new Color(globePalette.marker) };

  const cityGeometry = new BufferGeometry();
  cityGeometry.setAttribute(
    "position",
    attribute(
      cityPositions.flatMap((point) => point.toArray()),
      3
    )
  );
  const cityMaterial = new ShaderMaterial({
    depthWrite: false,
    fragmentShader: cityFragment,
    transparent: true,
    uniforms: {
      color: { value: new Color(globePalette.city) },
      pixelRatio: pixelRatioUniform,
      size: { value: citySize },
    },
    vertexShader: pointVertex,
  });
  const cityDots = new Points(cityGeometry, cityMaterial);
  cityDots.renderOrder = 2;
  globe.add(cityDots);

  const pillarGeometry = new BufferGeometry();
  pillarGeometry.setAttribute(
    "position",
    attribute(Array.from({ length: 4 }, () => homePosition.toArray()).flat(), 3)
  );
  pillarGeometry.setAttribute(
    "corner",
    attribute([-1, 0, 1, 0, -1, 1, 1, 1], 2)
  );
  pillarGeometry.setIndex([0, 1, 2, 2, 1, 3]);
  const pillarMaterial = new ShaderMaterial({
    blending: AdditiveBlending,
    depthWrite: false,
    fragmentShader: pillarFragment,
    side: DoubleSide,
    transparent: true,
    uniforms: {
      color: goldUniform,
      halfWidth: { value: pillarHalfWidth },
      motion: motionUniform,
      reach: { value: pillarReach },
      time: timeUniform,
      viewHeight: viewHeightUniform,
    },
    vertexShader: pillarVertex,
  });
  const pillar = new Mesh(pillarGeometry, pillarMaterial);
  pillar.frustumCulled = false;
  pillar.renderOrder = 1;
  globe.add(pillar);

  const beaconGeometry = new BufferGeometry();
  beaconGeometry.setAttribute("position", attribute(homePosition.toArray(), 3));
  const beaconMaterial = new ShaderMaterial({
    depthWrite: false,
    fragmentShader: beaconFragment,
    transparent: true,
    uniforms: {
      color: goldUniform,
      core: { value: new Color(globePalette.markerCore) },
      motion: motionUniform,
      pixelRatio: pixelRatioUniform,
      size: { value: beaconSize },
      time: timeUniform,
    },
    vertexShader: pointVertex,
  });
  const beacon = new Points(beaconGeometry, beaconMaterial);
  beacon.renderOrder = 3;
  globe.add(beacon);

  const cityLabels: Label[] = options.cities.map((city, index) => {
    const element = document.createElement("span");
    element.className = "city-label";
    element.textContent = city.name;
    options.labels.append(element);
    return {
      ...cityMark,
      element,
      height: 0,
      key: `city-${String(index)}`,
      position: cityPositions[index] ?? new Vector3(),
      shown: "",
      width: 0,
    };
  });
  const labels: Label[] = [
    {
      ...homeMark,
      element: options.homeLabel,
      height: 0,
      key: "home",
      position: homePosition,
      shown: "",
      width: 0,
    },
    ...cityLabels,
  ];

  const home: View = {
    lat: options.home.latitude,
    lon: options.home.longitude,
    zoom: homeZoom,
  };
  const view: View = reduce.matches
    ? { ...home }
    : {
        lat: home.lat - introLatitude,
        lon: wrap180(home.lon + introLongitude),
        zoom: introZoom,
      };
  const goal: View = { ...home };
  let width = 1;
  let height = 1;
  let baseDistance = 4;
  let tau = homeTau;
  let dragging = false;
  let velocity: Point = [0, 0];
  let touched = false;
  let disposed = false;
  let frozen = false;
  let compiled = false;
  let handle = 0;
  let lastDraw = 0;
  let sunAt = 0;

  const distance = (): number => 1 + (baseDistance - 1) / view.zoom;

  const refreshSun = (): void => {
    const { latitude, longitude } = subsolarPoint(new Date());
    sunObject.copy(vectorOf(longitude, latitude));
    sunAt = performance.now();
  };
  refreshSun();

  const apply = (): void => {
    globe.rotation.set(view.lat * deg, -view.lon * deg, 0);
    const lift = distance() - 1;
    const tilt = maxTilt * deg * smoothstep(tiltStart, tiltEnd, view.zoom);
    camera.position.set(0, -lift * Math.sin(tilt), 1 + lift * Math.cos(tilt));
    camera.lookAt(0, 0, 1);
    camera.updateMatrixWorld();
    const fade = smoothstep(europeFadeStart, europeFadeEnd, view.zoom);
    europeOpacity.value = fade;
    europe.visible = fade > 0.01;
    sunView
      .copy(sunObject)
      .applyQuaternion(globe.quaternion)
      .transformDirection(camera.matrixWorldInverse);
  };

  let laidOut = "";
  let blocked: LabelRect[] = [];

  const measureLabels = (): void => {
    for (const label of labels) {
      label.width = label.element.offsetWidth;
      label.height = label.element.offsetHeight;
    }
    blocked = options.avoid.map((element) => ({
      height: element.offsetHeight,
      width: element.offsetWidth,
      x: element.offsetLeft,
      y: element.offsetTop,
    }));
    laidOut = "";
  };

  const world = new Vector3();
  const toCamera = new Vector3();
  const screen = new Vector3();
  const sides = new Map<string, LabelSide>();

  const layoutLabels = (): void => {
    const state = [view.lat, view.lon, view.zoom, width, height]
      .map(String)
      .join(" ");
    if (state === laidOut) return;
    laidOut = state;
    const anchors: LabelAnchor[] = [];
    const alphas = new Map<string, number>();
    for (const label of labels) {
      if (label.width === 0) continue;
      world.copy(label.position).applyQuaternion(globe.quaternion);
      toCamera.copy(camera.position).sub(world).normalize();
      const facing = toCamera.dot(world) / world.length();
      if (facing < labelFacing) continue;
      screen.copy(world).project(camera);
      const x = ((screen.x + 1) / 2) * width;
      const y = ((1 - screen.y) / 2) * height;
      if (x < 0 || x > width || y < 0 || y > height) continue;
      anchors.push({
        height: label.height,
        key: label.key,
        offset: label.offset,
        radius: label.radius,
        width: label.width,
        x,
        y,
      });
      alphas.set(
        label.key,
        0.3 + 0.7 * smoothstep(labelFacing, labelFacing + 0.25, facing)
      );
    }
    const placed = placeLabels(
      anchors,
      width,
      height,
      labelGap,
      sides,
      blocked
    );
    const spots = new Map<string, PlacedLabel>();
    sides.clear();
    for (const spot of placed) {
      spots.set(spot.key, spot);
      sides.set(spot.key, spot.side);
    }
    for (const label of labels) {
      const spot = spots.get(label.key);
      const x = String(Math.round(spot?.x ?? 0));
      const y = String(Math.round(spot?.y ?? 0));
      const alpha = (alphas.get(label.key) ?? 0).toFixed(2);
      const shown = spot ? `${x},${y},${alpha}` : "";
      if (shown === label.shown) continue;
      label.shown = shown;
      if (spot) {
        label.element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        label.element.style.opacity = alpha;
      } else {
        label.element.style.opacity = "0";
      }
    }
  };

  const resize = (): void => {
    width = Math.max(1, canvas.clientWidth);
    height = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    pixelRatioUniform.value = pixelRatio;
    viewHeightUniform.value = height;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const fit = Math.tan((fov * deg) / 2) * Math.min(1, camera.aspect);
    baseDistance = Math.sqrt(1 + (1 / (fitRatio * fit)) ** 2);
    measureLabels();
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
    layoutLabels();
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
    motionUniform.value = reduce.matches ? 0 : 1;
    timeUniform.value += reduce.matches ? 0 : dt / 1000;
    if (performance.now() - sunAt > sunRefreshMs) refreshSun();
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
    if (!settled() || !reduce.matches) schedule();
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

  const onMotion = (): void => {
    wake();
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("webglcontextlost", onLost);
  reduce.addEventListener("change", onMotion);

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
      refreshSun();
      pacer.reset();
      lastDraw = 0;
      wake();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  const sunTimer = globalThis.setInterval(() => {
    if (!reduce.matches || document.hidden) return;
    refreshSun();
    wake();
  }, sunRefreshMs);

  resize();
  void document.fonts.ready.then(() => {
    if (disposed) return;
    measureLabels();
    wake();
  });
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
    interact();
  };

  return {
    dispose: (): void => {
      disposed = true;
      if (handle !== 0) cancelAnimationFrame(handle);
      handle = 0;
      globalThis.clearInterval(sunTimer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reduce.removeEventListener("change", onMotion);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("webglcontextlost", onLost);
      for (const label of cityLabels) label.element.remove();
      options.homeLabel.removeAttribute("style");
      for (const texture of textures) texture.dispose();
      for (const geometry of [
        baseGeometry,
        europeGeometry,
        haloGeometry,
        cityGeometry,
        pillarGeometry,
        beaconGeometry,
      ]) {
        geometry.dispose();
      }
      for (const material of [
        baseMaterial,
        europeMaterial,
        haloMaterial,
        cityMaterial,
        pillarMaterial,
        beaconMaterial,
      ]) {
        material.dispose();
      }
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
