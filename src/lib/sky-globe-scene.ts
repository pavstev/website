import {
  BufferAttribute,
  BufferGeometry,
  CustomBlending,
  Group,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  OrthographicCamera,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from "three";

import { type LatLon } from "./geo.ts";
import { deg } from "./math.ts";
import { type PlaceTable } from "./place-name.ts";
import { toVector } from "./sky-globe.ts";
import { globePalette } from "./sky-palette.ts";
import { hexBytes } from "./theme.ts";

export interface GlobeScene {
  addCities: (table: PlaceTable) => void;
  dispose: () => void;
  draw: (view: GlobeView) => void;
  radius: (zoom: number) => number;
  resize: (width: number, height: number) => void;
}

interface GlobeView {
  lat: number;
  lon: number;
  zoom: number;
}

const atmosphereRadius = 1.18;
const cityLift = 1.004;
const maxPixelRatio = 2;

const color = (hex: string): Vector3 => {
  const [r, g, b] = hexBytes(hex);
  return new Vector3(r / 255, g / 255, b / 255);
};

const earthVertex = `
varying vec3 vObj;
varying float vNz;
void main() {
  vObj = position;
  vNz = normalize(normalMatrix * normal).z;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const earthFragment = `
uniform vec3 uBase;
uniform vec3 uDay;
uniform vec3 uLine;
uniform vec3 uRim;
uniform vec3 uSun;
varying vec3 vObj;
varying float vNz;

float gridLine(float angle, float step) {
  float c = angle / step;
  float d = abs(fract(c - 0.5) - 0.5) / max(fwidth(c), 0.0001);
  return 1.0 - min(d, 1.0);
}

void main() {
  vec3 p = normalize(vObj);
  float lat = degrees(asin(clamp(p.y, -1.0, 1.0)));
  float lon = degrees(atan(p.x, p.z));
  float meridians = gridLine(lon, 30.0) * (1.0 - smoothstep(70.0, 86.0, abs(lat)));
  float parallels = gridLine(lat, 30.0) * (1.0 - step(89.0, abs(lat)));
  float grid = max(meridians, parallels);
  float day = smoothstep(-0.15, 0.4, dot(p, uSun));
  vec3 col = mix(uBase, uDay, day * 0.6);
  float rim = pow(1.0 - clamp(vNz, 0.0, 1.0), 3.0);
  col += uRim * rim * 0.4;
  col = mix(col, uLine, grid * 0.17);
  gl_FragColor = vec4(col, 1.0);
}
`;

const cityVertex = `
uniform float uSize;
uniform vec3 uSun;
varying float vAlpha;
void main() {
  vec3 n = normalize(position);
  float facing = normalize(normalMatrix * n).z;
  float night = 1.0 - 0.7 * smoothstep(-0.1, 0.35, dot(n, uSun));
  vAlpha = smoothstep(0.03, 0.22, facing) * night;
  gl_PointSize = uSize;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const cityFragment = `
uniform vec3 uColor;
uniform float uGain;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.15, 1.0, d)) * vAlpha * uGain;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor * a, a);
}
`;

const atmosphereVertex = `
varying vec3 vNormal;
void main() {
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const atmosphereFragment = `
uniform vec3 uColor;
uniform vec3 uSunView;
uniform float uOuter;
varying vec3 vNormal;
void main() {
  float r = sqrt(max(0.0, 1.0 - vNormal.z * vNormal.z)) * uOuter;
  float t = clamp((r - 1.0) / (uOuter - 1.0), 0.0, 1.0);
  float halo = r >= 1.0 ? pow(1.0 - t, 2.6) * 0.5 : 0.0;
  float inner = r < 1.0 ? pow(r, 9.0) * 0.28 : 0.0;
  float lit = smoothstep(-0.4, 0.7, dot(normalize(vNormal), uSunView));
  float a = (halo + inner) * (0.45 + 0.55 * lit);
  gl_FragColor = vec4(uColor * a, a * 0.65);
}
`;

const premultiplied = {
  blendDst: OneMinusSrcAlphaFactor,
  blending: CustomBlending,
  blendSrc: OneFactor,
} as const;

export const createGlobeScene = (
  canvas: HTMLCanvasElement,
  sun: LatLon
): GlobeScene => {
  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: true,
    canvas,
    powerPreference: "low-power",
  });
  renderer.setClearColor(0, 0);
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, maxPixelRatio));

  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.set(0, 0, 3);

  const globe = new Group();
  scene.add(globe);

  const sunObject = (() => {
    const v = toVector(sun);
    return new Vector3(v.x, v.y, v.z);
  })();
  const sunView = new Vector3();

  const earthGeometry = new SphereGeometry(1, 72, 48);
  const earthMaterial = new ShaderMaterial({
    fragmentShader: earthFragment,
    uniforms: {
      uBase: { value: color(globePalette.base) },
      uDay: { value: color(globePalette.day) },
      uLine: { value: color(globePalette.graticule) },
      uRim: { value: color(globePalette.rim) },
      uSun: { value: sunObject },
    },
    vertexShader: earthVertex,
  });
  globe.add(new Mesh(earthGeometry, earthMaterial));

  const atmosphereGeometry = new SphereGeometry(atmosphereRadius, 72, 48);
  const atmosphereMaterial = new ShaderMaterial({
    ...premultiplied,
    depthTest: false,
    depthWrite: false,
    fragmentShader: atmosphereFragment,
    transparent: true,
    uniforms: {
      uColor: { value: color(globePalette.atmosphere) },
      uOuter: { value: atmosphereRadius },
      uSunView: { value: sunView },
    },
    vertexShader: atmosphereVertex,
  });
  const atmosphere = new Mesh(atmosphereGeometry, atmosphereMaterial);
  atmosphere.renderOrder = 2;
  scene.add(atmosphere);

  const gain = { value: 0.6 };
  const size = { value: 2 };
  const cityMaterial = new ShaderMaterial({
    ...premultiplied,
    depthWrite: false,
    fragmentShader: cityFragment,
    transparent: true,
    uniforms: {
      uColor: { value: color(globePalette.city) },
      uGain: gain,
      uSize: size,
      uSun: { value: sunObject },
    },
    vertexShader: cityVertex,
  });
  let cityGeometry: BufferGeometry | undefined;
  let cityPoints: Points | undefined;

  let width = 0;
  let height = 0;

  const radius = (zoom: number): number =>
    (Math.min(width, height) / 2 / atmosphereRadius) * zoom;

  const addCities = (table: PlaceTable): void => {
    cityGeometry?.dispose();
    if (cityPoints) globe.remove(cityPoints);
    const positions = new Float32Array(table.length * 3);
    for (const [index, place] of table.entries()) {
      const v = toVector(place);
      positions[index * 3] = v.x * cityLift;
      positions[index * 3 + 1] = v.y * cityLift;
      positions[index * 3 + 2] = v.z * cityLift;
    }
    cityGeometry = new BufferGeometry();
    cityGeometry.setAttribute("position", new BufferAttribute(positions, 3));
    cityPoints = new Points(cityGeometry, cityMaterial);
    cityPoints.frustumCulled = false;
    cityPoints.renderOrder = 1;
    globe.add(cityPoints);
  };

  const resize = (nextWidth: number, nextHeight: number): void => {
    width = nextWidth;
    height = nextHeight;
    if (width > 0 && height > 0) renderer.setSize(width, height, false);
  };

  const draw = (view: GlobeView): void => {
    if (!(width > 0 && height > 0)) return;
    const px = radius(view.zoom);
    camera.left = -width / 2 / px;
    camera.right = width / 2 / px;
    camera.top = height / 2 / px;
    camera.bottom = -height / 2 / px;
    camera.updateProjectionMatrix();
    globe.rotation.set(view.lat * deg, -view.lon * deg, 0, "XYZ");
    globe.updateMatrixWorld();
    sunView.copy(sunObject).applyQuaternion(globe.quaternion);
    const zoomStep = Math.log2(view.zoom);
    size.value = renderer.getPixelRatio() * Math.min(1.3 + 0.8 * zoomStep, 4.5);
    gain.value = Math.min(1, 0.42 + 0.16 * zoomStep);
    renderer.render(scene, camera);
  };

  const dispose = (): void => {
    earthGeometry.dispose();
    earthMaterial.dispose();
    atmosphereGeometry.dispose();
    atmosphereMaterial.dispose();
    cityGeometry?.dispose();
    cityMaterial.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };

  return { addCities, dispose, draw, radius, resize };
};
