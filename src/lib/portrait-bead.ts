import { skyRgb } from "@/lib/theme";
import { hasSeenSoftwareRenderer, isSoftwareRenderer } from "@/lib/webgl";

export interface PortraitBead {
  dispose: () => void;
  hide: () => void;
  move: (x: number, y: number) => void;
  show: (x: number, y: number) => void;
}

const maxPixelRatio = 3;
const growRate = 7;
const followRate = 14;

const vertexSource = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = vec2(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentSource = `#version 300 es
precision highp float;
uniform sampler2D photo;
uniform vec2 pointer;
uniform vec2 velocity;
uniform float hover;
uniform vec3 cool;
uniform vec3 warm;
in vec2 vUv;
out vec4 color;
void main() {
  float radius = max(0.22 * hover, 1e-4);
  float speed = clamp(length(velocity) * 9.0, 0.0, 0.45);
  vec2 dir = length(velocity) > 1e-5 ? normalize(velocity) : vec2(1.0, 0.0);
  vec2 rel = vUv - pointer;
  float along = dot(rel, dir);
  vec2 shaped = (rel - along * dir) * (1.0 + speed * 0.5) + along * dir / (1.0 + speed);
  float r = length(shaped) / radius;
  vec2 lightDir = normalize(vec2(-0.55, -0.8));
  if (r >= 1.0) {
    vec2 relN = rel / radius;
    float drop = smoothstep(1.2, 0.85, length(relN - vec2(0.067, 0.11))) * 0.3;
    float facing = max(dot(normalize(relN + 1e-4), -lightDir), 0.0);
    float caustic = smoothstep(0.16, 0.0, abs(length(relN) - 1.1)) * pow(facing, 3.0) * 0.35;
    color = vec4(warm * caustic, caustic + drop * (1.0 - caustic)) * hover;
    return;
  }
  vec2 dd = shaped / radius;
  float z = sqrt(max(0.0, 1.0 - dot(dd, dd)));
  vec2 bend = dd * (1.0 - z) * radius;
  vec2 lens = pointer + rel * 0.583;
  vec3 inside = vec3(
    texture(photo, lens - bend * 0.34).r,
    texture(photo, lens - bend * 0.4).g,
    texture(photo, lens - bend * 0.47).b
  );
  vec3 n = normalize(vec3(dd, z));
  float fresnel = pow(1.0 - z, 3.0);
  vec3 front = normalize(normalize(vec3(lightDir, 0.9)) + vec3(0.0, 0.0, 1.0));
  vec3 back = normalize(normalize(vec3(0.5, 0.75, 0.6)) + vec3(0.0, 0.0, 1.0));
  float glint = pow(max(dot(n, front), 0.0), 140.0) * 1.4;
  float sheen = pow(max(dot(n, front), 0.0), 12.0) * 0.16;
  float bounce = pow(max(dot(n, back), 0.0), 40.0) * 0.35;
  float edge = smoothstep(0.86, 1.0, r) * smoothstep(1.0, 0.95, r);
  vec3 glass = inside * (1.04 + 0.06 * z) + cool * fresnel * 0.55;
  glass += vec3(glint + sheen + edge * 0.25) + warm * bounce;
  float alpha = smoothstep(1.0, 0.97, r) * smoothstep(0.0, 0.25, hover);
  color = vec4(min(glass, vec3(1.0)) * alpha, alpha);
}
`;

interface Engine {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  locations: Record<string, null | WebGLUniformLocation>;
}

interface Pending {
  canvas: HTMLCanvasElement;
  completion: null | number;
  gl: WebGL2RenderingContext;
  image: HTMLImageElement | null;
  program: WebGLProgram;
}

const compile = (
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): null | WebGLShader => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
};

const startEngine = (): null | Pending => {
  if (hasSeenSoftwareRenderer()) return null;
  const canvas = document.createElement("canvas");
  canvas.className = "portrait-bead";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl2", {
    antialias: false,
    depth: false,
    powerPreference: "low-power",
    stencil: false,
  });
  if (!gl || isSoftwareRenderer(gl)) return null;
  const program = gl.createProgram();
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  const parallel = gl.getExtension("KHR_parallel_shader_compile") as null | {
    COMPLETION_STATUS_KHR: number;
  };
  return {
    canvas,
    completion: parallel?.COMPLETION_STATUS_KHR ?? null,
    gl,
    image: null,
    program,
  };
};

const isCompiled = (pending: Pending): boolean =>
  pending.completion === null ||
  pending.gl.getProgramParameter(pending.program, pending.completion) === true;

const finishEngine = (host: HTMLElement, pending: Pending): Engine | null => {
  const { canvas, gl, image, program } = pending;
  if (!image || !gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW
  );
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR_MIPMAP_LINEAR
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const locations = Object.fromEntries(
    ["cool", "hover", "photo", "pointer", "velocity", "warm"].map((name) => [
      name,
      gl.getUniformLocation(program, name),
    ])
  );
  gl.uniform1i(locations["photo"] ?? null, 0);
  gl.uniform3fv(locations["cool"] ?? null, skyRgb("blue"));
  gl.uniform3fv(locations["warm"] ?? null, skyRgb("gold"));
  host.append(canvas);
  return { canvas, gl, locations };
};

export const createPortraitBead = (
  host: HTMLElement,
  source: string
): PortraitBead => {
  let engine: Engine | null | undefined;
  let pending: null | Pending = null;
  let poll: ReturnType<typeof globalThis.setTimeout> | undefined;
  let frame = 0;
  let last = 0;
  let hover = 0;
  let target = 0;
  const aim = { x: 0.5, y: 0.5 };
  const smooth = { x: 0.5, y: 0.5 };
  const velocity = { x: 0, y: 0 };

  const fit = (current: Engine): void => {
    const ratio = Math.min(globalThis.devicePixelRatio || 1, maxPixelRatio);
    const side = Math.max(1, Math.round(host.clientWidth * ratio));
    if (current.canvas.width === side && current.canvas.height === side) {
      return;
    }
    current.canvas.width = side;
    current.canvas.height = side;
    current.gl.viewport(0, 0, side, side);
  };

  const clear = (current: Engine): void => {
    current.gl.clearColor(0, 0, 0, 0);
    current.gl.clear(current.gl.COLOR_BUFFER_BIT);
  };

  const draw = (now: number): void => {
    frame = 0;
    const current = engine;
    if (!current) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
    last = now;
    hover += (target - hover) * (1 - Math.exp(-dt * growRate));
    const follow = 1 - Math.exp(-dt * followRate);
    const stepX = (aim.x - smooth.x) * follow;
    const stepY = (aim.y - smooth.y) * follow;
    smooth.x += stepX;
    smooth.y += stepY;
    const scale = 1 / Math.max(dt * 60, 1e-3);
    velocity.x += (stepX * scale - velocity.x) * 0.25;
    velocity.y += (stepY * scale - velocity.y) * 0.25;
    const { gl, locations } = current;
    clear(current);
    if (target === 0 && hover < 0.004) {
      hover = 0;
      last = 0;
      return;
    }
    gl.uniform1f(locations["hover"] ?? null, hover);
    gl.uniform2f(locations["pointer"] ?? null, smooth.x, smooth.y);
    gl.uniform2f(locations["velocity"] ?? null, velocity.x, velocity.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    frame = globalThis.requestAnimationFrame(draw);
  };

  const run = (): void => {
    if (frame !== 0 || !engine) return;
    fit(engine);
    frame = globalThis.requestAnimationFrame(draw);
  };

  const check = (): void => {
    poll = undefined;
    if (!pending) return;
    if (!pending.image || !isCompiled(pending)) {
      poll = globalThis.setTimeout(check, 50);
      return;
    }
    engine = finishEngine(host, pending);
    pending = null;
    engine?.canvas.addEventListener(
      "webglcontextlost",
      () => {
        engine?.canvas.remove();
        engine = null;
      },
      { once: true }
    );
    if (target === 0) return;
    smooth.x = aim.x;
    smooth.y = aim.y;
    run();
  };

  const load = async (started: Pending): Promise<void> => {
    const image = new Image();
    image.decoding = "async";
    image.src = source;
    try {
      await image.decode();
      started.image = image;
    } catch {
      if (pending !== started) return;
      started.gl.getExtension("WEBGL_lose_context")?.loseContext();
      pending = null;
      engine = null;
    }
  };

  const prepare = (): void => {
    if (engine !== undefined || pending) return;
    pending = startEngine();
    if (!pending) {
      engine = null;
      return;
    }
    void load(pending);
    check();
  };

  const place = (x: number, y: number): void => {
    aim.x = x;
    aim.y = y;
  };

  return {
    dispose: (): void => {
      if (frame !== 0) globalThis.cancelAnimationFrame(frame);
      frame = 0;
      if (poll !== undefined) globalThis.clearTimeout(poll);
      pending?.gl.getExtension("WEBGL_lose_context")?.loseContext();
      pending = null;
      engine?.canvas.remove();
      engine?.gl.getExtension("WEBGL_lose_context")?.loseContext();
      engine = null;
    },
    hide: (): void => {
      target = 0;
    },
    move: place,
    show: (x: number, y: number): void => {
      place(x, y);
      if (target === 0 && hover < 0.004) {
        smooth.x = x;
        smooth.y = y;
        velocity.x = 0;
        velocity.y = 0;
      }
      target = 1;
      prepare();
      run();
    },
  };
};
