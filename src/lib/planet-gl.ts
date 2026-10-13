import { clamp01 } from "@/lib/math";
import { hexBytes } from "@/lib/theme";

export type Color3 = [number, number, number];

export interface Geometry {
  count: number;
  dispose: () => void;
  vao: WebGLVertexArrayObject;
}

export interface GlProgram {
  dispose: () => void;
  program: WebGLProgram;
  uniform: (name: string) => null | WebGLUniformLocation;
}

export type Mat4 = number[];

const srgbToLinear = (c: number): number =>
  c < 0.04045
    ? c * 0.0773993808
    : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);

export const parseHex = (value: string): Color3 | undefined => {
  const match = /^#([\da-f]+)$/i.exec(value.trim());
  const digits = match?.[1];
  if (!digits) return undefined;
  const full = digits.length === 3 ? digits.replaceAll(/(.)/g, "$1$1") : digits;
  if (full.length !== 6) return undefined;
  const [r, g, b] = hexBytes(`#${full}`);
  return [srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255)];
};

const hueToRgb = (p: number, q: number, t: number): number => {
  let k = t;
  if (k < 0) k += 1;
  if (k > 1) k -= 1;
  if (k < 1 / 6) return p + (q - p) * 6 * k;
  if (k < 1 / 2) return q;
  return k < 2 / 3 ? p + (q - p) * 6 * (2 / 3 - k) : p;
};

export const offsetHsl = (
  [r, g, b]: Color3,
  dh: number,
  ds: number,
  dl: number
): Color3 => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (min + max) / 2;
  let hue = 0;
  let saturation = 0;
  if (min !== max) {
    const delta = max - min;
    saturation = delta / (lightness <= 0.5 ? max + min : 2 - max - min);
    if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue /= 6;
  }
  const h = (((hue + dh) % 1) + 1) % 1;
  const s = clamp01(saturation + ds);
  const l = clamp01(lightness + dl);
  if (s === 0) return [l, l, l];
  const p = l <= 0.5 ? l * (1 + s) : l + s - l * s;
  const q = 2 * l - p;
  return [
    hueToRgb(q, p, h + 1 / 3),
    hueToRgb(q, p, h),
    hueToRgb(q, p, h - 1 / 3),
  ];
};

export const compose = (
  position: Color3,
  rotation: Color3,
  scale: number
): Mat4 => {
  const [x, y, z] = rotation;
  const a = Math.cos(x);
  const b = Math.sin(x);
  const c = Math.cos(y);
  const d = Math.sin(y);
  const e = Math.cos(z);
  const f = Math.sin(z);
  const ae = a * e;
  const af = a * f;
  const be = b * e;
  const bf = b * f;
  return [
    c * e * scale,
    (af + be * d) * scale,
    (bf - ae * d) * scale,
    0,
    -c * f * scale,
    (ae - bf * d) * scale,
    (be + af * d) * scale,
    0,
    d * scale,
    -b * c * scale,
    a * c * scale,
    0,
    position[0],
    position[1],
    position[2],
    1,
  ];
};

export const multiply = (left: Mat4, right: Mat4): Mat4 => {
  const out: Mat4 = Array.from({ length: 16 }, () => 0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) {
        sum += (left[k * 4 + row] ?? 0) * (right[column * 4 + k] ?? 0);
      }
      out[column * 4 + row] = sum;
    }
  }
  return out;
};

export const normalMatrix = (m: Mat4): Float32Array => {
  const at = (index: number): number => m[index] ?? 0;
  const [n11, n21, n31, n12, n22, n32, n13, n23, n33] = [
    at(0),
    at(1),
    at(2),
    at(4),
    at(5),
    at(6),
    at(8),
    at(9),
    at(10),
  ];
  const t11 = n33 * n22 - n32 * n23;
  const t12 = n32 * n13 - n33 * n12;
  const t13 = n23 * n12 - n22 * n13;
  const det = n11 * t11 + n21 * t12 + n31 * t13;
  const inv = det === 0 ? 0 : 1 / det;
  return new Float32Array([
    t11 * inv,
    t12 * inv,
    t13 * inv,
    (n31 * n23 - n33 * n21) * inv,
    (n33 * n11 - n31 * n13) * inv,
    (n21 * n13 - n23 * n11) * inv,
    (n32 * n21 - n31 * n22) * inv,
    (n31 * n12 - n32 * n11) * inv,
    (n22 * n11 - n21 * n12) * inv,
  ]);
};

export const orthographic = (
  width: number,
  height: number,
  near: number,
  far: number
): Float32Array => {
  const w = 1 / width;
  const h = 1 / height;
  const p = 1 / (far - near);
  return new Float32Array([
    2 * w,
    0,
    0,
    0,
    0,
    2 * h,
    0,
    0,
    0,
    0,
    -2 * p,
    0,
    -width * w,
    height * h,
    -(far + near) * p,
    1,
  ]);
};

const upload = (
  gl: WebGL2RenderingContext,
  positions: number[],
  normals: number[],
  indices: number[]
): Geometry => {
  const vao = gl.createVertexArray();
  const buffers = [
    gl.createBuffer(),
    gl.createBuffer(),
    gl.createBuffer(),
  ] as const;
  const [positionBuffer, normalBuffer, indexBuffer] = buffers;
  gl.bindVertexArray(vao);
  for (const [location, buffer, data] of [
    [0, positionBuffer, positions],
    [1, normalBuffer, normals],
  ] as const) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0);
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices),
    gl.STATIC_DRAW
  );
  gl.bindVertexArray(null);
  return {
    count: indices.length,
    dispose: (): void => {
      gl.deleteVertexArray(vao);
      for (const buffer of buffers) gl.deleteBuffer(buffer);
    },
    vao,
  };
};

export const createSphere = (
  gl: WebGL2RenderingContext,
  widthSegments: number,
  heightSegments: number
): Geometry => {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const grid: number[][] = [];
  let index = 0;
  for (let iy = 0; iy <= heightSegments; iy += 1) {
    const row: number[] = [];
    const theta = (iy / heightSegments) * Math.PI;
    const y = Math.cos(theta);
    const ringRadius = Math.sqrt(1 - y * y);
    for (let ix = 0; ix <= widthSegments; ix += 1) {
      const phi = (ix / widthSegments) * Math.PI * 2;
      const x = -ringRadius * Math.cos(phi);
      const z = ringRadius * Math.sin(phi);
      positions.push(x, y, z);
      const length = Math.hypot(x, y, z) || 1;
      normals.push(x / length, y / length, z / length);
      row.push(index);
      index += 1;
    }
    grid.push(row);
  }
  const at = (iy: number, ix: number): number => grid[iy]?.[ix] ?? 0;
  for (let iy = 0; iy < heightSegments; iy += 1) {
    for (let ix = 0; ix < widthSegments; ix += 1) {
      const a = at(iy, ix + 1);
      const b = at(iy, ix);
      const c = at(iy + 1, ix);
      const d = at(iy + 1, ix + 1);
      if (iy !== 0) indices.push(a, b, d);
      if (iy !== heightSegments - 1) indices.push(b, c, d);
    }
  }
  return upload(gl, positions, normals, indices);
};

export const createRing = (
  gl: WebGL2RenderingContext,
  inner: number,
  outer: number,
  segments: number
): Geometry => {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (const radius of [inner, inner + (outer - inner)]) {
    for (let i = 0; i <= segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      positions.push(radius * Math.cos(angle), radius * Math.sin(angle), 0);
      normals.push(0, 0, 1);
    }
  }
  for (let i = 0; i < segments; i += 1) {
    const a = i;
    const b = i + segments + 1;
    const c = i + segments + 2;
    const d = i + 1;
    indices.push(a, b, d, b, c, d);
  }
  return upload(gl, positions, normals, indices);
};

const vertexPrefix = `#version 300 es
#define attribute in
#define varying out
#define texture2D texture
precision highp float;
precision highp int;
precision highp sampler2D;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
attribute vec3 position;
attribute vec3 normal;
`;

const fragmentPrefix = `#version 300 es
#define varying in
layout(location = 0) out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
#define texture2D texture
precision highp float;
precision highp int;
precision highp sampler2D;
vec4 sRGBTransferOETF( in vec4 value ) {
  return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}
vec4 linearToOutputTexel( vec4 value ) {
  return sRGBTransferOETF( vec4( value.rgb * mat3( 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0 ), value.a ) );
}
`;

const colorspaceChunk = "#include <colorspace_fragment>";

const compileShader = (
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("shader unavailable");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
};

export const createProgram = (
  gl: WebGL2RenderingContext,
  vertexBody: string,
  fragmentBody: string
): GlProgram => {
  const program = gl.createProgram();
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexPrefix + vertexBody);
  const fragment = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentPrefix +
      fragmentBody.replace(
        colorspaceChunk,
        "gl_FragColor = linearToOutputTexel( gl_FragColor );"
      )
  );
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, "position");
  gl.bindAttribLocation(program, 1, "normal");
  gl.linkProgram(program);
  const locations = new Map<string, null | WebGLUniformLocation>();
  return {
    dispose: (): void => {
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    },
    program,
    uniform: (name: string): null | WebGLUniformLocation => {
      if (!locations.has(name)) {
        locations.set(name, gl.getUniformLocation(program, name));
      }
      return locations.get(name) ?? null;
    },
  };
};

export const whenLinked = async (
  gl: WebGL2RenderingContext,
  programs: GlProgram[],
  checkErrors: boolean,
  abandoned: () => boolean = () => false
): Promise<void> => {
  const parallel = gl.getExtension("KHR_parallel_shader_compile");
  if (parallel) {
    const done = (): boolean =>
      programs.every(
        ({ program }) =>
          gl.getProgramParameter(
            program,
            parallel.COMPLETION_STATUS_KHR
          ) as boolean
      );
    while (!done() && !gl.isContextLost() && !abandoned()) {
      await new Promise((resolve) => {
        globalThis.setTimeout(resolve, 10);
      });
    }
  }
  if (abandoned()) return;
  if (!parallel && !checkErrors) return;
  for (const { program } of programs) {
    if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) {
      throw new Error(
        checkErrors ? (gl.getProgramInfoLog(program) ?? "link") : "link"
      );
    }
  }
};
