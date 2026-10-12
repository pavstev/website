export const windReach = 0.62;

const rows = 48;
const maxColumns = 256;
const pressureSteps = 20;
const pressureCarry = 0.8;
const airCalm = 0.9;
const curlLift = 2.4;
const handRadius = 0.075;
const handGrip = 16;
const handTop = 3;
const homeRate = 0.22;
const thinRate = 0.75;
const healRate = 0.5;
const thinMax = 0.85;
const shiftMax = 0.4;
const maxStep = 0.05;
const busyMs = 3000;
const settleMs = 16_000;

interface WindGrid {
  columns: number;
  rows: number;
}

const windGrid = (width: number): WindGrid => ({
  columns: Math.max(
    8,
    Math.min(maxColumns, Math.round((rows * width) / windReach))
  ),
  rows,
});

export interface CloudWind {
  bind: (unit: number) => void;
  busy: (now: number) => boolean;
  clear: () => void;
  dispose: () => void;
  push: (from: [number, number], to: [number, number], now: number) => void;
  resize: (width: number) => void;
  step: (dt: number, now: number) => void;
}

const vertex = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const head = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform vec2 u_texel;
uniform vec2 u_cell;
uniform vec2 u_size;
uniform float u_dt;
`;

const curlSource = `${head}
uniform sampler2D u_vel;
void main() {
  float l = texture(u_vel, v_uv - vec2(u_texel.x, 0.0)).y;
  float r = texture(u_vel, v_uv + vec2(u_texel.x, 0.0)).y;
  float b = texture(u_vel, v_uv - vec2(0.0, u_texel.y)).x;
  float t = texture(u_vel, v_uv + vec2(0.0, u_texel.y)).x;
  o = vec4((r - l) / (2.0 * u_cell.x) - (t - b) / (2.0 * u_cell.y), 0.0, 0.0, 1.0);
}`;

const vorticitySource = `${head}
uniform sampler2D u_vel;
uniform sampler2D u_curl;
uniform float u_lift;
void main() {
  float l = abs(texture(u_curl, v_uv - vec2(u_texel.x, 0.0)).x);
  float r = abs(texture(u_curl, v_uv + vec2(u_texel.x, 0.0)).x);
  float b = abs(texture(u_curl, v_uv - vec2(0.0, u_texel.y)).x);
  float t = abs(texture(u_curl, v_uv + vec2(0.0, u_texel.y)).x);
  float c = texture(u_curl, v_uv).x;
  vec2 g = vec2((r - l) / (2.0 * u_cell.x), (t - b) / (2.0 * u_cell.y));
  vec2 n = g / (length(g) + 1e-5);
  vec2 f = u_lift * min(u_cell.x, u_cell.y) * c * vec2(n.y, -n.x);
  o = vec4(texture(u_vel, v_uv).xy + f * u_dt, 0.0, 1.0);
}`;

const handSource = `${head}
uniform sampler2D u_vel;
uniform vec2 u_from;
uniform vec2 u_to;
uniform vec2 u_hand;
uniform float u_radius;
uniform float u_grip;
void main() {
  vec2 v = texture(u_vel, v_uv).xy;
  vec2 x = v_uv * u_size;
  vec2 ab = u_to - u_from;
  float h = clamp(dot(x - u_from, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
  vec2 d = x - u_from - ab * h;
  float g = exp(-dot(d, d) / (u_radius * u_radius)) * u_grip;
  o = vec4(mix(v, u_hand, g), 0.0, 1.0);
}`;

const advectSource = `${head}
uniform sampler2D u_vel;
uniform sampler2D u_src;
uniform float u_keep;
void main() {
  vec2 v = texture(u_vel, v_uv).xy;
  o = vec4(texture(u_src, v_uv - v * u_dt / u_size).xy * u_keep, 0.0, 1.0);
}`;

const divergenceSource = `${head}
uniform sampler2D u_vel;
void main() {
  vec2 c = texture(u_vel, v_uv).xy;
  float l = texture(u_vel, v_uv - vec2(u_texel.x, 0.0)).x;
  float r = texture(u_vel, v_uv + vec2(u_texel.x, 0.0)).x;
  float b = texture(u_vel, v_uv - vec2(0.0, u_texel.y)).y;
  float t = texture(u_vel, v_uv + vec2(0.0, u_texel.y)).y;
  if (v_uv.y - u_texel.y < 0.0) b = -c.y;
  o = vec4((r - l) / (2.0 * u_cell.x) + (t - b) / (2.0 * u_cell.y), 0.0, 0.0, 1.0);
}`;

const pressureRead = `
float side(sampler2D p, vec2 uv, float c) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
  if (uv.y < 0.0) return c;
  return texture(p, uv).x;
}`;

const pressureSource = `${head}
uniform sampler2D u_pressure;
uniform sampler2D u_div;
${pressureRead}
void main() {
  float c = texture(u_pressure, v_uv).x;
  float l = side(u_pressure, v_uv - vec2(u_texel.x, 0.0), c);
  float r = side(u_pressure, v_uv + vec2(u_texel.x, 0.0), c);
  float b = side(u_pressure, v_uv - vec2(0.0, u_texel.y), c);
  float t = side(u_pressure, v_uv + vec2(0.0, u_texel.y), c);
  vec2 k = 1.0 / (u_cell * u_cell);
  float p = ((l + r) * k.x + (b + t) * k.y - texture(u_div, v_uv).x) / (2.0 * (k.x + k.y));
  o = vec4(p, 0.0, 0.0, 1.0);
}`;

const projectSource = `${head}
uniform sampler2D u_pressure;
uniform sampler2D u_vel;
${pressureRead}
void main() {
  float c = texture(u_pressure, v_uv).x;
  float l = side(u_pressure, v_uv - vec2(u_texel.x, 0.0), c);
  float r = side(u_pressure, v_uv + vec2(u_texel.x, 0.0), c);
  float b = side(u_pressure, v_uv - vec2(0.0, u_texel.y), c);
  float t = side(u_pressure, v_uv + vec2(0.0, u_texel.y), c);
  vec2 v = texture(u_vel, v_uv).xy - vec2((r - l) / (2.0 * u_cell.x), (t - b) / (2.0 * u_cell.y));
  if (v_uv.y < u_texel.y) v.y = max(v.y, 0.0);
  o = vec4(v, 0.0, 1.0);
}`;

const scaleSource = `${head}
uniform sampler2D u_src;
uniform float u_keep;
void main() {
  o = vec4(texture(u_src, v_uv).xyz * u_keep, 1.0);
}`;

const carrySource = `${head}
uniform sampler2D u_vel;
uniform sampler2D u_src;
uniform float u_home;
uniform float u_heal;
uniform float u_thin;
uniform float u_thinMax;
uniform float u_shiftMax;
void main() {
  vec2 v = texture(u_vel, v_uv).xy;
  vec3 m = texture(u_src, v_uv - v * u_dt / u_size).xyz;
  vec2 d = (m.xy + v * u_dt) * u_home;
  float s = length(d);
  if (s > u_shiftMax) d *= u_shiftMax / s;
  float e = min(u_thinMax, m.z * u_heal + length(v) * u_thin * u_dt);
  o = vec4(d, e, 1.0);
}`;

interface Pair {
  read: Target;
  write: Target;
}

interface Pass {
  program: WebGLProgram;
  uniforms: Map<string, null | WebGLUniformLocation>;
}

interface Target {
  buffer: WebGLFramebuffer;
  texture: WebGLTexture;
}

const compile = (
  gl: WebGL2RenderingContext,
  fragment: string
): Pass | undefined => {
  const program = gl.createProgram();
  const parts: Array<[number, string]> = [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ];
  for (const [type, source] of parts) {
    const shader = gl.createShader(type);
    if (!shader) return undefined;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.bindAttribLocation(program, 0, "a_pos");
  gl.linkProgram(program);
  return { program, uniforms: new Map() };
};

export const createCloudWind = (
  gl: WebGL2RenderingContext
): CloudWind | undefined => {
  if (
    !gl.getExtension("EXT_color_buffer_float") &&
    !gl.getExtension("EXT_color_buffer_half_float")
  )
    return undefined;
  const sources = {
    advect: advectSource,
    carry: carrySource,
    curl: curlSource,
    divergence: divergenceSource,
    hand: handSource,
    pressure: pressureSource,
    project: projectSource,
    scale: scaleSource,
    vorticity: vorticitySource,
  };
  const parallel = gl.getExtension("KHR_parallel_shader_compile");
  const passes = new Map<keyof typeof sources, Pass>();
  for (const [name, source] of Object.entries(sources) as Array<
    [keyof typeof sources, string]
  >) {
    const pass = compile(gl, source);
    if (!pass) {
      for (const made of passes.values()) gl.deleteProgram(made.program);
      return undefined;
    }
    passes.set(name, pass);
  }

  const vao = gl.createVertexArray();
  const quad = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  let grid = windGrid(1);
  let size: [number, number] = [1, windReach];
  let targets: Target[] = [];
  let velocity: Pair | undefined;
  let pressure: Pair | undefined;
  let matter: Pair | undefined;
  let curl: Target | undefined;
  let divergence: Target | undefined;
  let lastPush = -Infinity;
  let linked: boolean | undefined;
  let settled = true;
  const hands: Array<{
    from: [number, number];
    hand: [number, number];
    to: [number, number];
  }> = [];

  const makeTarget = (): Target => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA16F,
      grid.columns,
      grid.rows,
      0,
      gl.RGBA,
      gl.HALF_FLOAT,
      null
    );
    const buffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );
    const target = { buffer, texture };
    targets.push(target);
    return target;
  };

  const makePair = (): Pair => ({ read: makeTarget(), write: makeTarget() });

  const swap = (pair: Pair): void => {
    const { read } = pair;
    pair.read = pair.write;
    pair.write = read;
  };

  const drop = (): void => {
    for (const target of targets) {
      gl.deleteTexture(target.texture);
      gl.deleteFramebuffer(target.buffer);
    }
    targets = [];
  };

  const clear = (): void => {
    gl.clearColor(0, 0, 0, 0);
    for (const target of targets) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.buffer);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    hands.length = 0;
    settled = true;
  };

  const resize = (width: number): void => {
    const next = windGrid(width);
    size = [width, windReach];
    if (
      targets.length > 0 &&
      next.columns === grid.columns &&
      next.rows === grid.rows
    )
      return;
    drop();
    grid = next;
    velocity = makePair();
    pressure = makePair();
    matter = makePair();
    curl = makeTarget();
    divergence = makeTarget();
    clear();
  };

  const uniform = (pass: Pass, name: string): null | WebGLUniformLocation => {
    if (!pass.uniforms.has(name))
      pass.uniforms.set(name, gl.getUniformLocation(pass.program, name));
    return pass.uniforms.get(name) ?? null;
  };

  const run = (
    name: keyof typeof sources,
    target: Target,
    dt: number,
    set: (pass: Pass) => void
  ): void => {
    const pass = passes.get(name);
    if (!pass) return;
    gl.useProgram(pass.program);
    gl.uniform2f(uniform(pass, "u_texel"), 1 / grid.columns, 1 / grid.rows);
    gl.uniform2f(
      uniform(pass, "u_cell"),
      size[0] / grid.columns,
      size[1] / grid.rows
    );
    gl.uniform2f(uniform(pass, "u_size"), size[0], size[1]);
    gl.uniform1f(uniform(pass, "u_dt"), dt);
    set(pass);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.buffer);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const texture = (
    pass: Pass,
    name: string,
    unit: number,
    source: Target
  ): void => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, source.texture);
    gl.uniform1i(uniform(pass, name), unit);
  };

  const ready = (): boolean => {
    if (linked !== undefined) return linked;
    const programs = Array.from(passes.values(), ({ program }) => program);
    if (
      parallel &&
      programs.some(
        (program) =>
          gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR) !==
          true
      )
    )
      return false;
    linked = programs.every(
      (program) => gl.getProgramParameter(program, gl.LINK_STATUS) === true
    );
    return linked;
  };

  const step = (rawDt: number, now: number): void => {
    if (!velocity || !pressure || !matter || !curl || !divergence) return;
    if (!ready()) {
      hands.length = 0;
      return;
    }
    if (settled && hands.length === 0) return;
    if (now - lastPush > settleMs) {
      clear();
      return;
    }
    settled = false;
    const dt = Math.min(Math.max(rawDt, 0), maxStep);
    const vel = velocity;
    const press = pressure;
    const mat = matter;
    const curlTarget = curl;
    const divTarget = divergence;
    gl.bindVertexArray(vao);
    gl.viewport(0, 0, grid.columns, grid.rows);
    gl.disable(gl.BLEND);

    run("advect", vel.write, dt, (pass) => {
      texture(pass, "u_vel", 0, vel.read);
      texture(pass, "u_src", 1, vel.read);
      gl.uniform1f(uniform(pass, "u_keep"), Math.exp(-airCalm * dt));
    });
    swap(vel);

    for (const { from, hand, to } of hands.splice(0)) {
      run("hand", vel.write, dt, (pass) => {
        texture(pass, "u_vel", 0, vel.read);
        gl.uniform2f(uniform(pass, "u_from"), from[0], from[1]);
        gl.uniform2f(uniform(pass, "u_to"), to[0], to[1]);
        gl.uniform2f(uniform(pass, "u_hand"), hand[0], hand[1]);
        gl.uniform1f(uniform(pass, "u_radius"), handRadius);
        gl.uniform1f(uniform(pass, "u_grip"), 1 - Math.exp(-handGrip * dt));
      });
      swap(vel);
    }

    run("curl", curlTarget, dt, (pass) => {
      texture(pass, "u_vel", 0, vel.read);
    });
    run("vorticity", vel.write, dt, (pass) => {
      texture(pass, "u_vel", 0, vel.read);
      texture(pass, "u_curl", 1, curlTarget);
      gl.uniform1f(uniform(pass, "u_lift"), curlLift);
    });
    swap(vel);

    run("divergence", divTarget, dt, (pass) => {
      texture(pass, "u_vel", 0, vel.read);
    });
    run("scale", press.write, dt, (pass) => {
      texture(pass, "u_src", 0, press.read);
      gl.uniform1f(uniform(pass, "u_keep"), pressureCarry);
    });
    swap(press);
    for (let index = 0; index < pressureSteps; index += 1) {
      run("pressure", press.write, dt, (pass) => {
        texture(pass, "u_pressure", 0, press.read);
        texture(pass, "u_div", 1, divTarget);
      });
      swap(press);
    }
    run("project", vel.write, dt, (pass) => {
      texture(pass, "u_pressure", 0, press.read);
      texture(pass, "u_vel", 1, vel.read);
    });
    swap(vel);

    run("carry", mat.write, dt, (pass) => {
      texture(pass, "u_vel", 0, vel.read);
      texture(pass, "u_src", 1, mat.read);
      gl.uniform1f(uniform(pass, "u_home"), Math.exp(-homeRate * dt));
      gl.uniform1f(uniform(pass, "u_heal"), Math.exp(-healRate * dt));
      gl.uniform1f(uniform(pass, "u_thin"), thinRate);
      gl.uniform1f(uniform(pass, "u_thinMax"), thinMax);
      gl.uniform1f(uniform(pass, "u_shiftMax"), shiftMax);
    });
    swap(mat);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
  };

  const push = (
    from: [number, number],
    to: [number, number],
    now: number
  ): void => {
    const seconds = Math.max((now - lastPush) / 1000, 1 / 120);
    const fresh = now - lastPush > 120;
    lastPush = now;
    if (fresh) return;
    let hx = (to[0] - from[0]) / seconds;
    let hy = (to[1] - from[1]) / seconds;
    const speed = Math.hypot(hx, hy);
    if (speed > handTop) {
      hx *= handTop / speed;
      hy *= handTop / speed;
    }
    hands.push({ from, hand: [hx, hy], to });
    if (hands.length > 8) hands.shift();
  };

  const bind = (unit: number): void => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, matter?.read.texture ?? null);
  };

  return {
    bind,
    busy: (now) => now - lastPush < busyMs,
    clear,
    dispose: () => {
      drop();
      for (const pass of passes.values()) gl.deleteProgram(pass.program);
      gl.deleteBuffer(quad);
      gl.deleteVertexArray(vao);
    },
    push,
    resize,
    step,
  };
};
