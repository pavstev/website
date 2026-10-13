import { landmarkCount } from "./sky-scene.ts";
import { textShade } from "./sky-shader.ts";
import { type Skyline, skylineStride } from "./skyline.ts";
import { createUniformSink, type UniformSink } from "./uniform-sink.ts";

export interface SkylineGl {
  dispose: () => void;
  draw: (frame: SkylineFrame, landmarks: Float32Array) => void;
}

interface SkylineFrame {
  ambient: Vec3;
  aspect: number;
  camera: Vec3;
  look: readonly [number, number];
  pointSize: number;
  sun: Vec3;
  sunColor: Vec3;
  text: Float32Array;
  time: number;
  under: Vec3;
  view: number;
  weather: SkylineWeather;
  wheel: number;
}

interface SkylineWeather {
  horizon: Vec3;
  nightOn: number;
  ramp: number;
  rim: Vec3;
  snow: number;
  visibility: number;
  wet: number;
  zenith: Vec3;
}

type Vec3 = readonly [number, number, number];

const windowShare = 0.34;
const coolShare = 0.3;
const floorBands = 0.35;
const floodGain = 1;
const aviation = 1;
const landmarkScale = 1.1;
const inkStrength = 0.6;
const inkLine = 0.85;

const skylineVertexShader = `
attribute vec3 a_pos;
attribute vec3 a_nrm;
attribute vec4 a_info;
attribute vec2 a_edge;
uniform vec3 u_cam;
uniform vec2 u_look;
uniform float u_aspect;
uniform vec4 u_land[${String(landmarkCount)}];
uniform vec4 u_wheel;
uniform vec3 u_axle;
uniform float u_ptSize;
varying vec3 v_w;
varying vec3 v_n;
varying vec4 v_info;
varying float v_z;
varying float v_flood;
varying vec3 v_bary;
varying float v_mask;
void main() {
  int id = int(a_info.x + 0.5);
  vec4 L = vec4(0.0);
  for (int i = 0; i < ${String(landmarkCount)}; i++) {
    if (i == id) L = u_land[i];
  }
  vec3 p = a_pos;
  vec3 n = a_nrm;
  if (a_info.z > 0.5) {
    vec3 k = u_axle;
    float c = cos(u_wheel.w);
    float s = sin(u_wheel.w);
    vec3 v = p - u_wheel.xyz;
    p = u_wheel.xyz + v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
    n = n * c + cross(k, n) * s + k * dot(k, n) * (1.0 - c);
  }
  float sc = id < ${String(landmarkCount)} ? ${landmarkScale.toFixed(2)} : 1.0;
  vec3 piv = vec3(L.x, 0.0, L.y);
  vec3 lp = (p - piv) * sc;
  vec3 fwd = normalize(vec3(piv.x + 0.001, 0.0, piv.z + 0.001));
  vec3 rt = vec3(fwd.z, 0.0, -fwd.x);
  float ca = cos(L.z);
  float sa = sin(L.z);
  float lx = dot(lp, rt);
  float nx = ca * lx - sa * lp.y;
  float ny = sa * lx + ca * lp.y;
  lp += rt * (nx - lx) + vec3(0.0, ny - lp.y + L.w * sc, 0.0);
  vec3 w = piv + lp;
  v_w = w;
  v_n = n;
  v_info = a_info;
  v_flood = a_edge.y;
  float corner = mod(a_edge.x, 3.0);
  v_bary = vec3(step(corner, 0.5), step(0.5, corner) * step(corner, 1.5), step(1.5, corner));
  v_mask = floor(a_edge.x / 3.0 + 0.01);
  vec3 v = w - vec3(0.0, u_cam.z, 0.0);
  v_z = length(v);
  float cy = cos(u_look.x);
  float sy = sin(u_look.x);
  v = vec3(cy * v.x - sy * v.z, v.y, sy * v.x + cy * v.z);
  float cp = cos(u_look.y);
  float sp = sin(u_look.y);
  v = vec3(v.x, cp * v.y - sp * v.z, sp * v.y + cp * v.z);
  float near = 20.0;
  float far = 60000.0;
  gl_Position = vec4(u_cam.x * v.x * 2.0 / u_aspect, (u_cam.x * v.y + u_cam.y * v.z) * 2.0 - v.z, (far + near) / (far - near) * v.z - 2.0 * far * near / (far - near), v.z);
  gl_PointSize = u_ptSize;
}`;

const fragmentBody = `
uniform vec3 u_sunDir;
uniform vec3 u_rimDir;
uniform vec3 u_sunCol;
uniform vec3 u_amb;
uniform vec3 u_under;
uniform vec4 u_env;
uniform vec4 u_env2;
uniform vec3 u_eye;
uniform vec3 u_skyHor;
uniform vec3 u_skyZen;
varying vec3 v_w;
varying vec3 v_n;
varying vec4 v_info;
varying float v_z;
varying float v_flood;
varying vec3 v_bary;
varying float v_mask;
uniform float u_feather;
${textShade}
const float cityCeiling = 0.11;
float textUnder(float fog) {
  float top = (1.055 * pow(cityCeiling, 1.0 / 2.4) - 0.055) * (1.0 - fog);
  return pow((top + 0.055) / 1.055, 2.4) + 0.0005;
}
const vec4 lightMix = vec4(${coolShare.toFixed(2)}, ${floorBands.toFixed(2)}, ${floodGain.toFixed(2)}, ${aviation.toFixed(2)});
const float windowShare = ${windowShare.toFixed(2)};
const float inkStrength = ${inkStrength.toFixed(2)};
const float inkLine = ${inkLine.toFixed(2)};
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
vec3 hue(float h) {
  return clamp(abs(fract(h + vec3(0.0, 0.667, 0.333)) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
}
float inkEdge() {
#ifdef INK_LINES
  float m = v_mask;
  float ab = step(0.5, mod(m, 2.0));
  float bc = step(0.5, mod(floor(m / 2.0), 2.0));
  float caE = step(0.5, floor(m / 4.0));
  vec3 d = vec3(mix(1.0, v_bary.x, bc), mix(1.0, v_bary.y, caE), mix(1.0, v_bary.z, ab));
  vec3 w = fwidth(v_bary);
  vec3 line = 1.0 - smoothstep(w * 0.8, w * 2.0, d);
  float size = max(w.x, max(w.y, w.z));
  return max(line.x, max(line.y, line.z)) * smoothstep(0.3, 0.1, size);
#else
  return 0.0;
#endif
}
vec3 inkStyle(vec3 col, vec3 n, vec3 V, float lit, float glow) {
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float level = log2(max(lum, 0.0001));
  float band = exp2(floor(level * 1.5 + 0.5) / 1.5);
  vec3 tone = col * band / max(lum, 0.0001);
  vec3 paper = mix(tone, vec3(dot(tone, vec3(0.33))) * vec3(1.06, 1.0, 0.9), 0.3);
  vec2 sp = gl_FragCoord.xy;
  float hatch = step(0.62, fract((sp.x + sp.y) * 0.25)) * smoothstep(0.35, 0.0, lit) * 0.35;
  paper *= 1.0 - hatch;
  float rim = 1.0 - smoothstep(0.08, 0.32, abs(dot(n, V)));
  float edge = max(inkEdge(), rim * step(0.5, 1.0 - step(0.5, v_mask)));
  vec3 styled = mix(col, paper, inkStrength);
  return mix(styled, styled * 0.12, edge * inkLine * (1.0 - glow));
}
vec3 shadeBuilding(vec3 n, vec3 V, float mat, float rnd) {
  float fog = 1.0 - exp(-v_z / u_env.w);
  float night = u_env.x;
  vec3 alb = vec3(0.5, 0.46, 0.4);
  float spec = 0.04;
  float gloss = 12.0;
  float refl = 0.0;
  if (mat > 0.5 && mat < 1.5) {
    float zig = abs(fract((v_w.x + v_w.z) / 16.0) - 0.5) * 16.0;
    float band = fract((v_w.y + zig) / 12.0);
    alb = band < 0.33 ? vec3(0.5, 0.4, 0.12) : band < 0.66 ? vec3(0.12, 0.26, 0.19) : vec3(0.1, 0.09, 0.08);
    spec = 0.15; gloss = 30.0;
  }
  else if (mat > 1.5 && mat < 2.5) { alb = vec3(0.21, 0.42, 0.35); spec = 0.35; gloss = 28.0; refl = 0.25; }
  else if ((mat > 2.5 && mat < 3.5) || (mat > 11.5 && mat < 12.5)) { alb = vec3(0.045, 0.06, 0.08); spec = 1.2; gloss = 90.0; refl = 1.0; }
  else if (mat > 3.5 && mat < 4.5) alb = vec3(0.52, 0.52, 0.5);
  else if (mat > 4.5 && mat < 5.5) { alb = vec3(0.16, 0.16, 0.17); spec = 0.3; gloss = 20.0; }
  else if (mat > 5.5 && mat < 6.5) alb = vec3(0.6, 0.06, 0.05);
  else if (mat > 6.5 && mat < 7.5) alb = vec3(0.045, 0.075, 0.045);
  else if (mat > 7.5 && mat < 8.5) alb = rnd < 0.3 ? vec3(0.64, 0.56, 0.42) : rnd < 0.5 ? vec3(0.62, 0.48, 0.3) : rnd < 0.8 ? vec3(0.62, 0.6, 0.56) : vec3(0.46, 0.46, 0.46);
  else if (mat > 8.5 && mat < 9.5) alb = rnd < 0.6 ? vec3(0.26, 0.14, 0.1) : vec3(0.24, 0.25, 0.27);
  else if (mat > 9.5 && mat < 10.5) { alb = vec3(0.8, 0.56, 0.16); spec = 1.4; gloss = 40.0; refl = 0.5; }
  else if (mat > 10.5 && mat < 11.5) { vec2 cc = floor(vec2(v_w.x + v_w.z, v_w.y) / 9.0); alb = mix(vec3(0.62, 0.55, 0.45), hue(hash(cc)) * 0.6 + 0.15, step(0.55, hash(cc + 2.0))); }
  else if (mat > 12.5 && mat < 13.5) { alb = vec3(0.08, 0.1, 0.14); refl = 0.6; }
  float snowy = u_env.z * smoothstep(0.4, 0.75, n.y);
  alb = mix(alb, vec3(0.85, 0.87, 0.9), snowy);
  float wet = u_env.y * (1.0 - snowy);
  alb *= 1.0 - 0.4 * wet;
  refl = max(refl, wet * 0.5);
  vec3 L = normalize(u_sunDir);
  float nl = dot(n, L);
  float diff = max(nl, 0.0) * 0.88 + max(nl * 0.5 + 0.5, 0.0) * 0.12 * step(0.0, L.y);
  vec3 sunW = u_sunCol * vec3(1.07, 1.0, 0.88);
  vec3 skyC = u_amb * vec3(0.9, 0.98, 1.14);
  float ao = mix(0.5, 1.0, smoothstep(0.0, 10.0, v_w.y)) * (0.82 + 0.18 * max(n.y, 0.0));
  vec3 col = alb * (sunW * diff + skyC * (0.62 + 0.38 * n.y) * 1.25 * ao + u_under * (1.25 - 0.75 * n.y) * ao);
  vec3 H = normalize(L + V);
  col += sunW * spec * pow(max(dot(n, H), 0.0), gloss) * step(0.0, nl) * 0.5;
  float rimLight = pow(1.0 - max(dot(n, V), 0.0), 3.0) * max(dot(n, normalize(u_rimDir)), 0.0);
  col += sunW * alb * rimLight * 0.35;
  float fr = 0.04 + 0.96 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
  vec3 R = reflect(-V, n);
  vec3 env = R.y > 0.0 ? mix(u_skyHor, u_skyZen, smoothstep(0.0, 0.5, R.y)) : u_skyHor * 0.3 + u_under * 0.6;
  col += env * refl * mix(0.08, 1.0, fr) * 1.2;
  bool walls = (mat > 2.5 && mat < 4.5) || (mat > 7.5 && mat < 8.5) || (mat > 10.5 && mat < 12.5);
  float ramp = u_env2.w;
  vec3 em = vec3(0.0);
  if (abs(n.y) < 0.3 && walls && ramp > 0.0) {
    vec2 tg = normalize(vec2(-n.z, n.x));
    vec2 g = vec2(dot(v_w.xz, tg) / 3.0, v_w.y / 3.4);
    vec2 cid = floor(g);
    vec2 f = fract(g);
    float win = step(0.28, f.x) * step(f.x, 0.76) * step(0.28, f.y) * step(f.y, 0.82);
    float pxCell = 3.4 * u_env2.z / v_z;
    float far = smoothstep(5.0, 2.0, pxCell);
    float h2 = hash(cid + 13.7 + rnd);
    float cool = lightMix.x;
    vec3 wc = h2 > 1.0 - cool * 0.18 ? vec3(0.35, 0.55, 1.0) : h2 > 1.0 - cool ? vec3(0.82, 0.9, 1.0) : h2 < 0.5 ? vec3(1.0, 0.58, 0.26) : vec3(1.0, 0.8, 0.56);
    float lit = step(hash(cid + rnd * 31.0), windowShare * ramp);
    float e = win * lit * (0.6 + 0.8 * hash(cid + 7.0));
    float m = exp2(floor(clamp(log2(6.0 / max(pxCell, 0.01)), 0.0, 4.0)));
    vec2 cg = floor(vec2(dot(v_w.xz, tg) / (3.0 * m), v_w.y / (3.4 * m)));
    float hc = hash(cg + rnd * 17.0 + m);
    vec3 cc = hc > 1.0 - cool * 0.5 ? vec3(0.85, 0.9, 1.0) : hc < 0.5 ? vec3(1.0, 0.62, 0.3) : vec3(1.0, 0.8, 0.56);
    em = mix(wc * e * 1.5, cc * step(hash(cg + 3.3 + m), windowShare * ramp) * 0.85, far);
    bool tower = (mat > 2.5 && mat < 3.5) || (mat > 11.5 && mat < 12.5);
    if (tower) {
      float bandOn = step(hash(vec2(cid.y, floor(rnd * 97.0))), lightMix.y) * step(0.22, f.y) * step(f.y, 0.86);
      vec3 bc = mat > 11.5 ? hue(cid.y * 0.045 + u_env2.y * 0.03) * 1.3 + 0.1 : vec3(0.8, 0.9, 1.0);
      float bandAll = mat > 11.5 ? step(0.2, f.y) * step(f.y, 0.9) * lightMix.y * 1.6 : 0.0;
      em += bc * max(bandOn, bandAll) * mix(1.0, 0.5, far) * ramp;
    }
    em *= 1.7 * step(3.4, v_w.y);
    col *= 1.0 - mix(win, 0.22, far) * 0.3 * (1.0 - ramp);
  }
  float fl = v_flood * lightMix.z * night;
  if (fl > 0.0) {
    em += alb * vec3(1.0, 0.78, 0.5) * fl * 1.15 * (1.0 - 0.55 * smoothstep(10.0, 150.0, v_w.y)) * (0.55 + 0.45 * max(dot(n, V), 0.0));
    if (v_info.z > 0.5 && mat > 4.5 && mat < 5.5) em += vec3(1.0, 0.86, 0.62) * fl * 1.3;
  }
  if (mat > 12.5 && mat < 13.5) em += vec3(0.25, 0.65, 1.0) * night * 2.0;
  float glow = clamp(dot(em, vec3(0.33)) * 4.0, 0.0, 1.0);
  col = inkStyle(col, n, V, diff, glow) + em;
  col = 1.0 - exp(-col * 0.805);
  return col * (1.0 - fog);
}
void main() {
  float mat = floor(v_info.y + 0.5);
  float fog = 1.0 - exp(-v_z / u_env.w);
  if (mat > 98.0) {
    vec2 pc = gl_PointCoord - 0.5;
    float r2 = dot(pc, pc) * 4.0;
    float blink = step(0.5, fract(u_env2.y * 0.75 + v_info.w));
    vec3 c = vec3(1.0, 0.1, 0.05) * exp(-r2 * 4.0) * 3.0 * u_env.x * blink * lightMix.w * (1.0 - fog * 0.8);
    gl_FragColor = vec4((1.0 - exp(-c * 0.805)) * (1.0 - textNear(gl_FragCoord.xy, u_feather)), 1.0);
    return;
  }
  vec3 n = normalize(v_n);
  vec3 V = normalize(u_eye - v_w);
  if (dot(n, V) < 0.0 && v_info.z < 0.5) n = normalize(n + V * (0.01 - dot(n, V)));
  gl_FragColor = vec4(capText(shadeBuilding(n, V, mat, v_info.w), textNear(gl_FragCoord.xy, u_feather), textUnder(fog)), fog);
}`;

const precision = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif`;

const skylineFragmentShader = (lines: boolean): string =>
  lines
    ? `#extension GL_OES_standard_derivatives : enable\n#define INK_LINES\n${precision}\n${fragmentBody}`
    : `${precision}\n${fragmentBody}`;

const compile = (
  gl: WebGLRenderingContext,
  type: number,
  source: string
): undefined | WebGLShader => {
  const shader = gl.createShader(type);
  if (!shader) return undefined;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
};

const upload = (
  gl: WebGLRenderingContext,
  data: Float32Array
): null | WebGLBuffer => {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return buffer;
};

export const createSkylineGl = (
  gl: WebGLRenderingContext,
  skyline: Skyline,
  onReady: () => void
): SkylineGl | undefined => {
  const lines = gl.getExtension("OES_standard_derivatives") !== null;
  const vertex = compile(gl, gl.VERTEX_SHADER, skylineVertexShader);
  const fragment = compile(
    gl,
    gl.FRAGMENT_SHADER,
    skylineFragmentShader(lines)
  );
  if (!vertex || !fragment) return undefined;
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  const parallel = gl.getExtension("KHR_parallel_shader_compile");
  let sink: undefined | UniformSink;
  let geometry: null | WebGLBuffer = null;
  let lights: null | WebGLBuffer = null;
  let handle = 0;
  const attributes = ["a_pos", "a_nrm", "a_info", "a_edge"].map((name) =>
    gl.getAttribLocation(program, name)
  );
  const poll = (): void => {
    if (
      parallel !== null &&
      gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR) !== true
    ) {
      handle = globalThis.requestAnimationFrame(poll);
      return;
    }
    if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) return;
    for (const [index, name] of [
      "a_pos",
      "a_nrm",
      "a_info",
      "a_edge",
    ].entries())
      attributes[index] = gl.getAttribLocation(program, name);
    geometry = upload(gl, skyline.geometry);
    lights = upload(gl, skyline.lights);
    sink = createUniformSink(gl, program);
    onReady();
  };
  handle = globalThis.requestAnimationFrame(poll);
  const sizes = [3, 3, 4, 2];
  const offsets = [0, 12, 24, 40];
  const bind = (buffer: null | WebGLBuffer): void => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    for (const [index, location] of attributes.entries()) {
      if (location < 0) continue;
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(
        location,
        sizes[index] ?? 3,
        gl.FLOAT,
        false,
        skylineStride * 4,
        offsets[index] ?? 0
      );
    }
  };
  const unbind = (): void => {
    for (const location of attributes)
      if (location >= 0) gl.disableVertexAttribArray(location);
  };
  const draw = (frame: SkylineFrame, landmarks: Float32Array): void => {
    if (!sink) return;
    const { weather } = frame;
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.frontFace(gl.CW);
    gl.cullFace(gl.BACK);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.SRC_ALPHA);
    sink.set("u_cam", ...frame.camera);
    sink.set("u_look", ...frame.look);
    sink.set("u_aspect", frame.aspect);
    sink.array("u_land", landmarks);
    sink.set("u_wheel", ...skyline.wheel.hub, frame.wheel);
    sink.set("u_axle", ...skyline.wheel.axle);
    sink.set("u_eye", 0, frame.camera[2], 0);
    sink.set("u_sunDir", ...frame.sun);
    sink.set("u_rimDir", ...weather.rim);
    sink.set("u_sunCol", ...frame.sunColor);
    sink.set("u_amb", ...frame.ambient);
    sink.set("u_under", ...frame.under);
    sink.set("u_skyHor", ...weather.horizon);
    sink.set("u_skyZen", ...weather.zenith);
    sink.set(
      "u_env",
      weather.nightOn,
      weather.wet,
      weather.snow,
      weather.visibility
    );
    sink.set(
      "u_env2",
      0,
      frame.time,
      frame.camera[0] * frame.view,
      weather.ramp
    );
    bind(geometry);
    sink.array("u_txt", frame.text);
    sink.set("u_feather", (64 * frame.view) / 900);
    sink.set("u_ptSize", 0);
    gl.drawArrays(gl.TRIANGLES, 0, skyline.count);
    if (weather.nightOn > 0.01) {
      bind(lights);
      gl.depthMask(false);
      sink.set("u_ptSize", frame.pointSize);
      gl.drawArrays(gl.POINTS, 0, skyline.lightCount);
      gl.depthMask(true);
    }
    unbind();
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
  };
  return {
    dispose: () => {
      globalThis.cancelAnimationFrame(handle);
      sink = undefined;
      gl.deleteBuffer(geometry);
      gl.deleteBuffer(lights);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    },
    draw,
  };
};
