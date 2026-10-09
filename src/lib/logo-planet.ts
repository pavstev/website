import {
  CanvasTexture,
  Color,
  Group,
  LinearMipmapLinearFilter,
  Mesh,
  NoColorSpace,
  ShaderMaterial,
  type SphereGeometry,
  type WebGLRenderer,
} from "three";

export interface LogoPlanet {
  dispose: () => void;
  group: Group;
  node: HTMLElement;
  uniforms: LogoUniforms;
}

interface LogoUniforms {
  [uniform: string]: { value: unknown };
  uAccent: { value: Color };
  uDisc: { value: Color };
  uEmboss: { value: number };
  uHot: { value: number };
  uMark: { value: Color };
  uMask: { value: CanvasTexture };
  uSpin: { value: number };
  uTime: { value: number };
  uTint: { value: Color };
}

const maskSize = 256;

const maskInk = {
  accent: "rgb(0,255,0)",
  mark: "rgb(255,0,0)",
  none: "rgb(0,0,0)",
} as const;

const logoVertex = `
varying vec3 vObj;
varying vec3 vNormal;
void main() {
  vObj = position;
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * viewPosition;
}
`;

const logoFragment = `
uniform vec3 uDisc;
uniform vec3 uMark;
uniform vec3 uAccent;
uniform vec3 uTint;
uniform float uEmboss;
uniform sampler2D uMask;
uniform float uSpin;
uniform float uHot;
uniform float uTime;
varying vec3 vObj;
varying vec3 vNormal;
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
void main() {
  vec3 p = normalize(vObj);
  float c = cos(uSpin);
  float s = sin(uSpin);
  vec3 q = vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  vec3 n = normalize(vNormal);
  vec3 v = vec3(0.0, 0.0, 1.0);
  vec3 sun = normalize(vec3(-0.6, 0.55, 0.58));
  float ndl = dot(n, sun);
  float facing = max(dot(n, v), 0.0);
  float shade = mix(0.16, 1.0, smoothstep(-0.35, 0.8, ndl));
  float front = smoothstep(0.0, 0.2, q.z);
  vec2 uv = q.xy * 0.5 + 0.5;
  vec4 ink = texture2D(uMask, uv);
  vec4 soft = texture2D(uMask, uv, 3.0);
  float inkAmt = min(ink.r + ink.g, 1.0) * front;
  float glowAmt = min(soft.r + soft.g, 1.0) * front;
  vec2 texel = vec2(0.03, 0.0);
  vec4 east = texture2D(uMask, uv + texel.xy, 1.5);
  vec4 west = texture2D(uMask, uv - texel.xy, 1.5);
  vec4 north = texture2D(uMask, uv + texel.yx, 1.5);
  vec4 south = texture2D(uMask, uv - texel.yx, 1.5);
  vec2 slope = vec2(
    (east.r + east.g) - (west.r + west.g),
    (north.r + north.g) - (south.r + south.g)
  );
  float relief = -dot(slope, normalize(sun.xy));
  float warp = noise3(q * 1.6 + vec3(0.0, uTime * 0.03, 0.0));
  float band = sin(q.y * 9.0 + warp * 3.0) * 0.5 + 0.5;
  float pat = mix(band, noise3(q * 2.4 + warp), 0.45);
  vec3 surface = mix(uDisc, uDisc + uTint * 0.07, pat);
  vec3 ground = surface * shade;
  vec3 paint = mix(uMark, uAccent, min(ink.g / max(ink.r + ink.g, 0.001), 1.0));
  vec3 mark = mix(paint, uTint, 0.22) * (0.6 + 0.4 * shade);
  mark *= 1.0 + relief * 0.3 * uEmboss;
  vec3 col = mix(ground, mark, inkAmt);
  col += mix(uTint, uMark, 0.4) * glowAmt * (1.0 - inkAmt) * 0.06;
  col += uTint * smoothstep(0.22, 0.0, abs(ndl - 0.05)) * 0.08;
  float sunSide = smoothstep(-0.3, 0.6, ndl);
  float rim = pow(1.0 - facing, 4.0) * (0.9 + 0.1 * sin(uTime * 1.4));
  col += uTint * rim * 0.65 * (0.3 + 0.7 * sunSide) * (1.0 + 0.8 * uHot);
  col += vec3(1.0) * pow(max(dot(reflect(-sun, n), v), 0.0), 6.0) * 0.035 * sunSide * (1.0 - inkAmt);
  col += uTint * 0.08 * uHot;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

const drawLogoMask = (svg: SVGSVGElement, size: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2d canvas unavailable");
  const box = svg.viewBox.baseVal;
  if (box.width <= 0 || box.height <= 0) throw new Error("logo without box");
  const paths = [...svg.querySelectorAll<SVGPathElement>("path[data-ink]")];
  if (paths.length === 0) throw new Error("logo without ink");
  context.fillStyle = maskInk.none;
  context.fillRect(0, 0, size, size);
  context.globalCompositeOperation = "lighter";
  const matrix =
    svg.querySelector("g")?.transform.baseVal.consolidate()?.matrix ??
    new DOMMatrix();
  context.setTransform(
    new DOMMatrix()
      .scale(size / box.width, size / box.height)
      .translate(-box.x, -box.y)
      .multiply(matrix)
  );
  for (const path of paths) {
    const d = path.getAttribute("d");
    if (!d) throw new Error("logo path without d");
    context.fillStyle =
      path.dataset["ink"] === "accent" ? maskInk.accent : maskInk.mark;
    context.fill(new Path2D(d));
  }
  return canvas;
};

const readHex = (style: CSSStyleDeclaration, name: string): Color => {
  const value = style.getPropertyValue(name).trim();
  if (!value.startsWith("#")) throw new Error(`logo without ${name}`);
  return new Color(value);
};

export const createLogoPlanet = (
  node: HTMLElement,
  sphere: SphereGeometry,
  renderer: WebGLRenderer,
  time: { value: number }
): LogoPlanet => {
  const svg = node.querySelector("svg");
  if (!svg) throw new Error("logo without svg");
  const style = getComputedStyle(node);
  const disc = readHex(style, "--logo-disc");
  const mark = readHex(style, "--logo-mark");
  const accent = readHex(style, "--logo-accent");
  const tint = readHex(style, "--lang");
  const emboss = Number(style.getPropertyValue("--logo-emboss"));
  const mask = drawLogoMask(svg, maskSize);
  const texture = new CanvasTexture(mask);
  texture.colorSpace = NoColorSpace;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  texture.minFilter = LinearMipmapLinearFilter;
  const uniforms: LogoUniforms = {
    uAccent: { value: accent },
    uDisc: { value: disc },
    uEmboss: { value: Number.isFinite(emboss) ? emboss : 0 },
    uHot: { value: 0 },
    uMark: { value: mark },
    uMask: { value: texture },
    uSpin: { value: 0 },
    uTime: time,
    uTint: { value: tint },
  };
  const material = new ShaderMaterial({
    fragmentShader: logoFragment,
    uniforms,
    vertexShader: logoVertex,
  });
  const group = new Group();
  group.add(new Mesh(sphere, material));
  return {
    dispose: (): void => {
      texture.dispose();
      material.dispose();
    },
    group,
    node,
    uniforms,
  };
};
