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
uniform sampler2D uMask;
uniform float uSpin;
uniform float uHot;
uniform float uTime;
varying vec3 vObj;
varying vec3 vNormal;
void main() {
  vec3 p = normalize(vObj);
  float c = cos(uSpin);
  float s = sin(uSpin);
  vec3 q = vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  vec3 n = normalize(vNormal);
  vec3 v = vec3(0.0, 0.0, 1.0);
  vec3 sun = normalize(vec3(-0.6, 0.55, 0.58));
  float ndl = dot(n, sun);
  float day = smoothstep(-0.18, 0.55, ndl);
  float terminator = smoothstep(0.22, 0.0, abs(ndl - 0.05));
  float facing = max(dot(n, v), 0.0);
  float rim = pow(1.0 - facing, 2.6) * (0.82 + 0.18 * sin(uTime * 1.4));
  float specular = pow(max(dot(reflect(-sun, n), v), 0.0), 34.0);
  vec4 ink = texture2D(uMask, q.xy * 0.5 + 0.5);
  float front = smoothstep(0.0, 0.15, q.z);
  vec3 base = mix(uDisc, uMark, ink.r * front);
  base = mix(base, uAccent, ink.g * front);
  vec3 lit = base * (0.85 + 0.25 * max(ndl, 0.0));
  vec3 col = mix(base * 0.1, lit, day);
  col += uTint * terminator * 0.12;
  col += mix(base * 0.1, uTint, day * 0.6 + 0.4) * rim * (1.1 + 0.8 * uHot);
  col += vec3(1.0) * specular * 0.22 * day;
  col += uTint * 0.1 * uHot;
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
  const mask = drawLogoMask(svg, maskSize);
  const texture = new CanvasTexture(mask);
  texture.colorSpace = NoColorSpace;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  texture.minFilter = LinearMipmapLinearFilter;
  const uniforms: LogoUniforms = {
    uAccent: { value: accent },
    uDisc: { value: disc },
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
