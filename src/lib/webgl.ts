type Gl = WebGL2RenderingContext | WebGLRenderingContext;

const softwarePattern = /swiftshader|llvmpipe|softpipe|software|basic render/i;

export const compileShader = (
  gl: Gl,
  type: number,
  source: string
): null | WebGLShader => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
};

export const linkProgram = (
  gl: Gl,
  program: WebGLProgram,
  shaders: readonly WebGLShader[],
  position?: string
): void => {
  for (const shader of shaders) gl.attachShader(program, shader);
  if (position !== undefined) gl.bindAttribLocation(program, 0, position);
  gl.linkProgram(program);
};

export const bindTriangle = (gl: Gl, slot: number): null | WebGLBuffer => {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(slot);
  gl.vertexAttribPointer(slot, 2, gl.FLOAT, false, 0, 0);
  return buffer;
};

export const clampedTexture = (gl: Gl, filter: number): void => {
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
};

let softwareSeen = false;

export const isSoftwareRenderer = (
  gl: WebGL2RenderingContext | WebGLRenderingContext
): boolean => {
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const name: unknown = gl.getParameter(
    info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER
  );
  const software = typeof name === "string" && softwarePattern.test(name);
  if (software) softwareSeen = true;
  return software;
};

export const hasSeenSoftwareRenderer = (): boolean => softwareSeen;
