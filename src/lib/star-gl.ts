import { type Mat3 } from "./sky-frame.ts";
import { type PlanetSight } from "./sky-planets.ts";
import { cloudGlsl, noiseGlsl, spaceGlsl } from "./sky-shader.ts";
import { type Basis } from "./sky-view.ts";
import { createUniformSink } from "./uniform-sink.ts";

export interface StarFrame {
  basis: Basis;
  camera: readonly [number, number, number];
  clouds: boolean;
  day: number;
  equatorial: Mat3;
  height: number;
  moon: readonly [number, number, number, number];
  moonSky: number;
  pixel: number;
  puffs: Float32Array;
  sun: readonly [number, number, number, number];
  time: number;
  weather: readonly [number, number, number, number];
  width: number;
  wind: readonly [number, number, number, number];
}

export interface StarGl {
  dispose: () => void;
  draw: (frame: StarFrame) => void;
  setPlanets: (planets: readonly PlanetSight[]) => void;
}

const floatsPerPoint = 8;
const floatsPerStar = 7;
const planetSlots = 5;
const starTwinkle = 1;
const planetTwinkle = 0.2;
const hiddenMagnitude = 99;
const linkPollMs = 16;
const attributes = ["a_dir", "a_mag", "a_col", "a_twinkle"] as const;
const sizes = [3, 1, 3, 1] as const;

export const starVertexShader = `
precision highp float;
attribute vec3 a_dir;
attribute float a_mag;
attribute vec3 a_col;
attribute float a_twinkle;
uniform mat3 u_eq;
uniform mat3 u_basis;
uniform vec3 u_cam;
uniform vec2 u_res;
uniform vec4 u_sun;
uniform vec4 u_moon;
uniform float u_moonSky;
uniform float u_day;
uniform vec4 u_weather;
uniform vec4 u_wind;
uniform vec4 u_wpuff[6];
uniform float u_time;
uniform float u_px;
uniform float u_clouds;
varying vec3 v_col;
${noiseGlsl}
${cloudGlsl}
${spaceGlsl}
const float degree = 0.0174533;
const float spaceStars = 2.0;

float lift(float h) {
  float hd = max(h / degree, -1.0);
  return 1.02 / tan((hd + 10.3 / (hd + 5.11)) * degree) / 60.0 * degree;
}

float airmass(float h) {
  float hd = max(h / degree, 0.0);
  return 1.0 / (sin(max(h, 0.0)) + 0.50572 * pow(hd + 6.07995, -1.6364));
}

float log10(float x) {
  return log(x) / 2.302585;
}

void main() {
  gl_PointSize = 0.0;
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  v_col = vec3(0.0);
  vec3 d = u_eq * a_dir;
  float h = asin(clamp(d.y, -1.0, 1.0));
  float hr = h + lift(h);
  if (hr <= 0.0) return;
  vec2 level = d.xz / max(length(d.xz), 0.000001);
  vec3 w = vec3(level.x * cos(hr), sin(hr), level.y * cos(hr));
  vec3 c = vec3(dot(w, u_basis[0]), dot(w, u_basis[1]), dot(w, u_basis[2]));
  if (c.z < -0.95) return;
  float moonAngle = acos(clamp(dot(w, u_moon.xyz), -1.0, 1.0));
  if (moonAngle < u_moon.w * 1.05) return;
  float dep = -u_sun.w / degree;
  float sky = pow(10.0, -0.4 * (4.0 + 17.8 * smoothstep(-5.0, 17.0, dep) - 1.2 * (1.0 - smoothstep(0.0, 0.5, hr))));
  sky += pow(10.0, -0.4 * 19.6) * u_moonSky * (1.0 + 6.0 * exp(-moonAngle / 0.18));
  sky *= pow(10.0, -0.4 * spaceMag(hr, u_day * (1.0 - u_weather.y) * (1.0 - 0.85 * u_weather.w)) * spaceStars);
  float sunAngle = acos(clamp(dot(w, u_sun.xyz), -1.0, 1.0));
  sky += pow(10.0, -0.4 * 8.0) * u_day * exp(-sunAngle / 0.08);
  float b = -2.5 * log10(sky);
  float limit = 7.93 - 5.0 * log10(pow(10.0, 4.316 - b / 5.0) + 1.0);
  float m = a_mag + 0.2 * airmass(hr) + 3.0 * u_weather.y * u_weather.y + 4.0 * u_weather.w;
  if (m >= limit + 0.25) return;
  if (u_clouds > 0.5) m += 1.086 * cloudDepth(w);
  float seen = smoothstep(limit + 0.25, limit - 0.75, m);
  if (seen <= 0.0) return;
  float lead = clamp((limit - m) / 5.5, 0.0, 1.6);
  float wave = sin(u_time * (2.5 + fract(a_dir.x * 913.7) * 5.0) + a_dir.y * 517.3);
  float tw = 1.0 + a_twinkle * 0.32 * wave * (0.3 + 0.7 * clamp(1.0 - hr / 1.2, 0.0, 1.0));
  v_col = a_col * seen * (0.3 + 1.1 * min(lead, 1.2)) * tw;
  float unit = (1.0 - u_cam.y) * u_res.y / u_cam.x;
  vec2 uv = c.xy / (1.0 + c.z);
  vec2 px = vec2(0.5 * u_res.x + uv.x * unit, u_cam.y * u_res.y + uv.y * unit);
  gl_PointSize = max((3.2 + 4.0 * pow(lead / 1.6, 1.3)) * u_px * 1.3, 3.0);
  gl_Position = vec4(px / u_res * 2.0 - 1.0, 0.0, 1.0);
}`;

export const starFragmentShader = `
precision mediump float;
varying vec3 v_col;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float r = length(q) * 2.0;
  float spot = exp(-r * r * 4.0) * smoothstep(1.0, 0.6, r);
  gl_FragColor = vec4(v_col * spot, 1.0);
}`;

const planetBlock = (planets: readonly PlanetSight[]): Float32Array => {
  const block = new Float32Array(planetSlots * floatsPerPoint);
  for (let slot = 0; slot < planetSlots; slot += 1) {
    const planet = planets[slot];
    block.set(
      planet
        ? [
            ...planet.direction,
            planet.magnitude,
            ...planet.color,
            planetTwinkle,
          ]
        : [0, 0, 1, hiddenMagnitude, 0, 0, 0, 0],
      slot * floatsPerPoint
    );
  }
  return block;
};

export const starPoints = (
  stars: Float32Array,
  planets: readonly PlanetSight[]
): Float32Array => {
  const starTotal = stars.length / floatsPerStar;
  const data = new Float32Array((starTotal + planetSlots) * floatsPerPoint);
  for (let index = 0; index < starTotal; index += 1) {
    data.set(
      stars.subarray(index * floatsPerStar, (index + 1) * floatsPerStar),
      index * floatsPerPoint
    );
    data[index * floatsPerPoint + 7] = starTwinkle;
  }
  data.set(planetBlock(planets), starTotal * floatsPerPoint);
  return data;
};

const compile = (
  gl: WebGLRenderingContext,
  type: number,
  source: string
): null | WebGLShader => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
};

export const createStarGl = (
  gl: WebGLRenderingContext,
  stars: Float32Array,
  onReady: () => void
): StarGl | undefined => {
  const vertex = compile(gl, gl.VERTEX_SHADER, starVertexShader);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, starFragmentShader);
  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  if (!vertex || !fragment || !program || !buffer) return undefined;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  const starTotal = stars.length / floatsPerStar;
  const count = starTotal + planetSlots;
  const data = starPoints(stars, []);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  const uniforms = createUniformSink(gl, program);
  let locations: number[] = [];
  const parallel = gl.getExtension("KHR_parallel_shader_compile");
  let linked: boolean | undefined;
  let waiting: ReturnType<typeof globalThis.setTimeout> | undefined;
  const poll = (): void => {
    waiting = undefined;
    if (
      parallel &&
      gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR) !== true
    ) {
      waiting = globalThis.setTimeout(poll, linkPollMs);
      return;
    }
    linked = gl.getProgramParameter(program, gl.LINK_STATUS) === true;
    if (!linked) return;
    locations = attributes.map((name) => gl.getAttribLocation(program, name));
    onReady();
  };
  poll();

  const setPlanets = (planets: readonly PlanetSight[]): void => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      starTotal * floatsPerPoint * Float32Array.BYTES_PER_ELEMENT,
      planetBlock(planets)
    );
  };

  const draw = (frame: StarFrame): void => {
    if (linked !== true) return;
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    let offset = 0;
    for (const [index, location] of locations.entries()) {
      const size = sizes[index] ?? 1;
      if (location >= 0) {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(
          location,
          size,
          gl.FLOAT,
          false,
          floatsPerPoint * Float32Array.BYTES_PER_ELEMENT,
          offset * Float32Array.BYTES_PER_ELEMENT
        );
      }
      offset += size;
    }
    uniforms.matrix("u_eq", frame.equatorial);
    uniforms.matrix("u_basis", frame.basis);
    uniforms.set("u_cam", ...frame.camera);
    uniforms.set("u_res", frame.width, frame.height);
    uniforms.set("u_sun", ...frame.sun);
    uniforms.set("u_moon", ...frame.moon);
    uniforms.set("u_moonSky", frame.moonSky);
    uniforms.set("u_day", frame.day);
    uniforms.set("u_weather", ...frame.weather);
    uniforms.set("u_wind", ...frame.wind);
    uniforms.array("u_wpuff", frame.puffs);
    uniforms.set("u_time", frame.time);
    uniforms.set("u_px", frame.pixel);
    uniforms.set("u_clouds", frame.clouds ? 1 : 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArrays(gl.POINTS, 0, count);
    gl.disable(gl.BLEND);
    for (const location of locations)
      if (location >= 0) gl.disableVertexAttribArray(location);
  };

  return {
    dispose: (): void => {
      if (waiting !== undefined) globalThis.clearTimeout(waiting);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    },
    draw,
    setPlanets,
  };
};
