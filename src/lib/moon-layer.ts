import { moonShader } from "./sky-moon-shader.ts";
import { noiseShader } from "./sky-paint-shader.ts";
import { type Rgb } from "./sky-paint.ts";
import { skyVertexShader } from "./sky-shader.ts";
import { createUniformSink } from "./uniform-sink.ts";

export interface MoonLayer {
  dispose: () => void;
  draw: (state: MoonLayerState) => void;
}

export interface MoonLayerState {
  cloud:
    | undefined
    | {
        at: readonly [number, number];
        data: Uint8Array;
        perCss: number;
        size: number;
      };
  color: Rgb;
  earth: number;
  fade: number;
  light: Rgb;
  north: readonly [number, number];
  radius: number;
  tint: Rgb;
  x: number;
  y: number;
}

export interface PatchRect {
  size: number;
  x: number;
  y: number;
}

export const maxPatch = 64;
const layerReach = 2.2;
const maxDensity = 2;
export const moonBump = 0.035;
const mapUnit = 0;
const patchUnit = 1;
const fadeMin = 0.002;

const fragmentShader = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec4 u_moon;
uniform vec3 u_moonCol;
uniform float u_moonGlow;
uniform sampler2D u_patch;
uniform vec4 u_patchMap;
uniform float u_patchOn;
${noiseShader}
${moonShader}
void main() {
  float cover;
  vec3 face = moonFace(gl_FragCoord.xy, cover);
  float open = 1.0;
  if (u_patchOn > 0.5) {
    vec2 texel = (gl_FragCoord.xy - u_moon.xy) * u_patchMap.x + u_patchMap.yz;
    open = 1.0 - texture2D(u_patch, texel / u_patchMap.w).a;
  }
  gl_FragColor = vec4(face * open, cover * open);
}`;

const contextOptions: WebGLContextAttributes = {
  alpha: true,
  antialias: false,
  depth: false,
  powerPreference: "low-power",
  premultipliedAlpha: true,
  stencil: false,
};

export const patchRect = (
  moon: { radius: number; x: number; y: number },
  cloud: { height: number; width: number },
  cloudPerCss: number
): PatchRect => {
  const size = Math.min(maxPatch, 2 * Math.ceil(moon.radius * cloudPerCss));
  const place = (center: number, extent: number): number =>
    Math.max(
      0,
      Math.min(extent - size, Math.round(center * cloudPerCss - size / 2))
    );
  return {
    size,
    x: place(moon.x, cloud.width),
    y: place(moon.y, cloud.height),
  };
};

export const layerPixels = (
  radius: number,
  dpr: number
): { css: number; device: number } => {
  const css = Math.ceil(layerReach * radius);
  return { css, device: Math.round(css * Math.min(dpr, maxDensity)) };
};

const compile = (
  gl: WebGLRenderingContext,
  type: number,
  source: string
): undefined | WebGLShader => {
  const shader = gl.createShader(type);
  if (!shader) return undefined;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) === true
    ? shader
    : undefined;
};

const setupTexture = (
  gl: WebGLRenderingContext,
  unit: number
): null | WebGLTexture => {
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
};

export const watchContextLoss = (
  target: EventTarget,
  onLost: () => void
): (() => void) => {
  const listener = (event: Event): void => {
    event.preventDefault();
    onLost();
  };
  target.addEventListener("webglcontextlost", listener);
  return () => {
    target.removeEventListener("webglcontextlost", listener);
  };
};

export const createMoonLayer = (
  host: HTMLElement,
  map: TexImageSource,
  onLost?: () => void
): MoonLayer | undefined => {
  const canvas = document.createElement("canvas");
  canvas.className = "moon-layer";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl", contextOptions);
  if (!gl) return undefined;
  const vertex = compile(gl, gl.VERTEX_SHADER, skyVertexShader);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentShader);
  const program = gl.createProgram();
  const release = (): void => {
    gl.deleteProgram(program);
    gl.deleteShader(vertex ?? null);
    gl.deleteShader(fragment ?? null);
  };
  if (!vertex || !fragment) {
    release();
    return undefined;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, "a_pos");
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) {
    release();
    return undefined;
  }
  const triangle = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, triangle);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const mapTexture = setupTexture(gl, mapUnit);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, map);
  const patchTexture = setupTexture(gl, patchUnit);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array(4)
  );
  gl.useProgram(program);
  gl.uniform1i(gl.getUniformLocation(program, "u_moonMap"), mapUnit);
  gl.uniform1i(gl.getUniformLocation(program, "u_patch"), patchUnit);
  const uniforms = createUniformSink(gl, program);
  uniforms.set("u_mapOn", 1);
  uniforms.set("u_bump", moonBump);
  uniforms.set("u_aura", 0);
  uniforms.set("u_moonGlow", 1);
  const anchor = host.querySelector("canvas");
  if (anchor) anchor.after(canvas);
  else host.append(canvas);
  let edge = 0;

  const draw = (state: MoonLayerState): void => {
    canvas.style.opacity = String(state.fade);
    if (state.fade < fadeMin) return;
    const { css, device } = layerPixels(state.radius, window.devicePixelRatio);
    if (edge !== device) {
      edge = device;
      canvas.width = device;
      canvas.height = device;
      canvas.style.width = `${String(css)}px`;
      canvas.style.height = `${String(css)}px`;
      gl.viewport(0, 0, device, device);
    }
    const box = host.getBoundingClientRect();
    canvas.style.transform = `translate3d(${String(state.x - css / 2 - box.left)}px, ${String(state.y - css / 2 - box.top)}px, 0)`;
    const density = device / css;
    uniforms.set("u_moon", device / 2, device / 2, state.radius * density, 1);
    uniforms.set("u_moonCol", ...state.color);
    uniforms.set("u_moonTint", ...state.tint);
    uniforms.set("u_moonL", ...state.light);
    uniforms.set("u_moonN", ...state.north);
    uniforms.set("u_earth", state.earth);
    const { cloud } = state;
    uniforms.set("u_patchOn", cloud ? 1 : 0);
    if (cloud) {
      gl.activeTexture(gl.TEXTURE0 + patchUnit);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        cloud.size,
        cloud.size,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        cloud.data
      );
      uniforms.set(
        "u_patchMap",
        cloud.perCss / density,
        cloud.at[0],
        cloud.at[1],
        cloud.size
      );
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const unwatch = watchContextLoss(canvas, () => onLost?.());

  const dispose = (): void => {
    unwatch();
    canvas.remove();
    gl.deleteTexture(mapTexture);
    gl.deleteTexture(patchTexture);
    gl.deleteBuffer(triangle);
    release();
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };

  return { dispose, draw };
};
