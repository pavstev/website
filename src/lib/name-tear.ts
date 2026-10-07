import { isSceneHeld } from "@/lib/scene-hold";
import { skyRgb } from "@/lib/theme";
import { hasSeenSoftwareRenderer, isSoftwareRenderer } from "@/lib/webgl";

export interface NameTear {
  dispose: () => void;
  play: () => void;
}

const tearMs = 520;
const maxPixelRatio = 2;

const vertexSource = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentSource = `#version 300 es
precision mediump float;
uniform sampler2D text;
uniform float progress;
uniform float seed;
uniform vec2 resolution;
uniform vec3 rose;
uniform vec3 teal;
in vec2 vUv;
out vec4 color;
float hash(float n) {
  return fract(sin(n * 91.3458 + seed) * 47453.5453);
}
void main() {
  float envelope = sin(3.14159 * progress);
  float tick = floor(progress * 18.0);
  float band = floor(vUv.y * 16.0);
  float torn = step(0.58, hash(band + tick * 7.0));
  float shift = (hash(band * 3.1 + tick) - 0.5) * 0.14 * torn * envelope;
  vec2 uv = vec2(vUv.x + shift, 1.0 - vUv.y);
  float split = (0.006 + 0.018 * torn) * envelope;
  float r = texture(text, uv + vec2(split, 0.0)).a;
  float g = texture(text, uv).a;
  float b = texture(text, uv - vec2(split, 0.0)).a;
  float scan = 0.86 + 0.14 * sin(vUv.y * resolution.y * 1.2);
  vec3 tint = rose * r * 0.9 + vec3(1.0) * g * 0.85 + teal * b * 0.9;
  float alpha = max(max(r, g), b) * (0.55 + 0.45 * scan);
  color = vec4(tint * scan, alpha);
}
`;

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

interface Engine {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  locations: Record<string, null | WebGLUniformLocation>;
  program: WebGLProgram;
  texture: WebGLTexture;
}

interface Pending {
  canvas: HTMLCanvasElement;
  completion: null | number;
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  texture: WebGLTexture;
}

const startEngine = (): null | Pending => {
  if (hasSeenSoftwareRenderer()) return null;
  const canvas = document.createElement("canvas");
  canvas.className = "name-tear";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl2", {
    antialias: false,
    depth: false,
    powerPreference: "low-power",
    premultipliedAlpha: false,
    stencil: false,
  });
  if (!gl || isSoftwareRenderer(gl)) return null;
  const program = gl.createProgram();
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const texture = gl.createTexture();
  if (!vertex || !fragment || !texture) return null;
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
    program,
    texture,
  };
};

const isCompiled = (pending: Pending): boolean =>
  pending.completion === null ||
  pending.gl.getProgramParameter(pending.program, pending.completion) === true;

const finishEngine = (host: HTMLElement, pending: Pending): Engine | null => {
  const { canvas, gl, program, texture } = pending;
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
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
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const locations = Object.fromEntries(
    ["progress", "resolution", "rose", "seed", "teal", "text"].map((name) => [
      name,
      gl.getUniformLocation(program, name),
    ])
  );
  gl.uniform3fv(locations["rose"] ?? null, skyRgb("rose"));
  gl.uniform3fv(locations["teal"] ?? null, skyRgb("teal"));
  gl.uniform1i(locations["text"] ?? null, 0);
  host.append(canvas);
  return { canvas, gl, locations, program, texture };
};

const paintText = (
  host: HTMLElement,
  canvas: HTMLCanvasElement,
  ratio: number
): HTMLCanvasElement | null => {
  const box = canvas.getBoundingClientRect();
  const source = document.createElement("canvas");
  source.width = Math.max(1, Math.round(box.width * ratio));
  source.height = Math.max(1, Math.round(box.height * ratio));
  const context = source.getContext("2d");
  if (!context) return null;
  const style = getComputedStyle(host);
  context.scale(ratio, ratio);
  context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  context.fillStyle = style.color;
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  const ascent = context.measureText("H").fontBoundingBoxAscent;
  for (const letter of host.querySelectorAll<HTMLElement>(".name-letter")) {
    const rect = letter.getBoundingClientRect();
    if (rect.width === 0) continue;
    context.fillText(
      letter.textContent,
      rect.left - box.left + rect.width / 2,
      rect.top - box.top + ascent
    );
  }
  return source;
};

export const createNameTear = (host: HTMLElement): NameTear => {
  let engine: Engine | null | undefined;
  let pending: null | Pending = null;
  let frame = 0;
  let started = 0;
  let poll: ReturnType<typeof globalThis.setTimeout> | undefined;
  let idle: number | undefined;

  const check = (): void => {
    poll = undefined;
    if (!pending) return;
    if (!isCompiled(pending)) {
      poll = globalThis.setTimeout(check, 120);
      return;
    }
    engine = finishEngine(host, pending);
    pending = null;
  };

  const prepare = (): void => {
    idle = undefined;
    if (engine !== undefined || pending) return;
    pending = startEngine();
    if (pending) check();
    else engine = null;
  };

  if (typeof globalThis.requestIdleCallback === "function") {
    idle = globalThis.requestIdleCallback(prepare, { timeout: 4000 });
  } else {
    poll = globalThis.setTimeout(prepare, 1500);
  }

  const stop = (): void => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    delete host.dataset["tearing"];
    if (!engine) {
      return;
    }

    engine.gl.clearColor(0, 0, 0, 0);
    engine.gl.clear(engine.gl.COLOR_BUFFER_BIT);
  };

  const draw = (now: number): void => {
    const current = engine;
    if (!current) return;
    const progress = Math.min(1, (now - started) / tearMs);
    const { gl, locations } = current;
    gl.uniform1f(locations["progress"] ?? null, progress);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    host.dataset["tearing"] = "";
    if (progress < 1) frame = requestAnimationFrame(draw);
    else stop();
  };

  return {
    dispose: (): void => {
      stop();
      if (idle !== undefined) globalThis.cancelIdleCallback(idle);
      if (poll !== undefined) globalThis.clearTimeout(poll);
      pending?.gl.getExtension("WEBGL_lose_context")?.loseContext();
      pending = null;
      engine?.canvas.remove();
      engine?.gl.getExtension("WEBGL_lose_context")?.loseContext();
      engine = null;
    },
    play: (): void => {
      if (frame || !engine || isSceneHeld()) return;
      const ratio = Math.min(globalThis.devicePixelRatio || 1, maxPixelRatio);
      const { canvas, gl, locations, texture } = engine;
      const source = paintText(host, canvas, ratio);
      if (!source) return;
      canvas.width = source.width;
      canvas.height = source.height;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source
      );
      gl.uniform2f(
        locations["resolution"] ?? null,
        canvas.width,
        canvas.height
      );
      gl.uniform1f(locations["seed"] ?? null, Math.random() * 100);
      started = performance.now();
      frame = requestAnimationFrame(draw);
    },
  };
};
