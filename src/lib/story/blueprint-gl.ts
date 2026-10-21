import { hexBytes, storyPalette } from "@/lib/theme";
import { compileShader, isSoftwareRenderer, linkProgram } from "@/lib/webgl";

import { type Scene, strides, toneNames } from "./blueprint-geometry";

export interface DimBox {
  height: number;
  left: number;
  top: number;
  width: number;
}

export interface Renderer {
  dispose(): void;
  draw(
    scene: Scene,
    view: Float32Array,
    gridView: Float32Array,
    dim: DimBox | undefined
  ): void;
  resize(): void;
}

const maxRatio = 1.5;
const dimTo = 0.35;
const dimEdge = 8;
const pointFloats = strides.point;
const triVertexFloats = pointFloats;

const lineVertex = [
  "#version 300 es",
  "layout(location=0) in vec3 aA;",
  "layout(location=1) in vec3 aB;",
  "layout(location=2) in vec2 aStyle;",
  "uniform mat4 uM;",
  "uniform vec2 uRes;",
  "uniform vec2 uWidth;",
  "uniform float uSlab;",
  "uniform vec3 uTone[8];",
  "out vec4 vCol;",
  "void main(){",
  "vec4 a=uM*vec4(aA,1.0);",
  "vec4 b=uM*vec4(aB,1.0);",
  "vec2 h=uRes*0.5;",
  "vec2 sa=a.xy/a.w*h;",
  "vec2 sb=b.xy/b.w*h;",
  "vec2 d=sb-sa;",
  "float l=length(d);",
  "d=l>0.0001?d/l:vec2(1.0,0.0);",
  "vec2 n=vec2(-d.y,d.x);",
  "float w=float(gl_InstanceID)<uSlab?uWidth.y:uWidth.x;",
  "float side=(gl_VertexID&1)==0?-1.0:1.0;",
  "bool far=gl_VertexID>1;",
  "vec4 c=far?b:a;",
  "vec2 s=(far?sb:sa)+n*side*w*0.5;",
  "gl_Position=vec4(s/h*c.w,c.z,c.w);",
  "vCol=vec4(uTone[int(aStyle.x)],aStyle.y);",
  "}",
].join("\n");

const lineFragment = [
  "#version 300 es",
  "precision highp float;",
  "in vec4 vCol;",
  "uniform vec4 uDim;",
  "uniform float uDimTo;",
  "out vec4 o;",
  "void main(){",
  "vec2 q=abs(gl_FragCoord.xy-uDim.xy)-uDim.zw;",
  `float inside=1.0-smoothstep(-${dimEdge.toFixed(1)},${dimEdge.toFixed(1)},max(q.x,q.y));`,
  "o=vec4(vCol.rgb,vCol.a*mix(1.0,uDimTo,inside));",
  "}",
].join("\n");

const flatVertex = [
  "#version 300 es",
  "layout(location=0) in vec3 aPos;",
  "layout(location=1) in vec3 aMeta;",
  "uniform mat4 uM;",
  "uniform float uScale;",
  "uniform vec3 uTone[8];",
  "out vec4 vCol;",
  "void main(){",
  "gl_Position=uM*vec4(aPos,1.0);",
  "gl_PointSize=aMeta.z*uScale;",
  "vCol=vec4(uTone[int(aMeta.x)],aMeta.y);",
  "}",
].join("\n");

const flatFragment = [
  "#version 300 es",
  "precision highp float;",
  "in vec4 vCol;",
  "uniform float uRound;",
  "out vec4 o;",
  "void main(){",
  "float a=uRound>0.5?smoothstep(0.5,0.26,length(gl_PointCoord-0.5)):1.0;",
  "o=vec4(vCol.rgb,vCol.a*a);",
  "}",
].join("\n");

const toneTable = (): Float32Array => {
  const table = new Float32Array(toneNames.length * 3);
  for (const [i, name] of toneNames.entries()) {
    const [r, g, b] = hexBytes(storyPalette[name]);
    table.set([r / 255, g / 255, b / 255], i * 3);
  }
  return table;
};

interface Program {
  handle: WebGLProgram;
  shaders: WebGLShader[];
}

const release = (gl: WebGL2RenderingContext, program: Program): void => {
  gl.deleteProgram(program.handle);
  for (const shader of program.shaders) gl.deleteShader(shader);
};

const build = (
  gl: WebGL2RenderingContext,
  vertex: string,
  fragment: string
): Program | undefined => {
  const handle = gl.createProgram();
  const shaders = [
    compileShader(gl, gl.VERTEX_SHADER, vertex),
    compileShader(gl, gl.FRAGMENT_SHADER, fragment),
  ].filter((shader): shader is WebGLShader => shader !== null);
  const program = { handle, shaders };
  if (shaders.length === 2) linkProgram(gl, handle, shaders);
  if (shaders.length === 2 && gl.getProgramParameter(handle, gl.LINK_STATUS)) {
    return program;
  }
  release(gl, program);
  return undefined;
};

const attribute = (
  gl: WebGL2RenderingContext,
  buffer: WebGLBuffer,
  slot: number,
  size: number,
  stride: number,
  offset: number,
  divisor: number
): void => {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(slot);
  gl.vertexAttribPointer(slot, size, gl.FLOAT, false, stride * 4, offset * 4);
  gl.vertexAttribDivisor(slot, divisor);
};

export const createRenderer = (
  canvas: HTMLCanvasElement
): Renderer | undefined => {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: true,
    depth: false,
    powerPreference: "low-power",
    stencil: false,
  });
  if (!gl) return undefined;
  const lose = (): void => {
    if (!gl.isContextLost()) {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  };
  if (isSoftwareRenderer(gl)) {
    lose();
    return;
  }

  const lineProgram = build(gl, lineVertex, lineFragment);
  const flatProgram = build(gl, flatVertex, flatFragment);
  const lineArrays = gl.createVertexArray();
  const triArrays = gl.createVertexArray();
  const pointArrays = gl.createVertexArray();
  const lineBuffer = gl.createBuffer();
  const styleBuffer = gl.createBuffer();
  const triBuffer = gl.createBuffer();
  const pointBuffer = gl.createBuffer();
  const cleanup = (): void => {
    if (lineProgram) release(gl, lineProgram);
    if (flatProgram) release(gl, flatProgram);
    gl.deleteVertexArray(lineArrays);
    gl.deleteVertexArray(triArrays);
    gl.deleteVertexArray(pointArrays);
    for (const buffer of [lineBuffer, styleBuffer, triBuffer, pointBuffer]) {
      gl.deleteBuffer(buffer);
    }
  };
  if (
    !lineProgram ||
    !flatProgram ||
    !lineArrays ||
    !triArrays ||
    !pointArrays ||
    !lineBuffer ||
    !styleBuffer ||
    !triBuffer ||
    !pointBuffer
  ) {
    cleanup();
    lose();
    return;
  }

  const tones = toneTable();
  const where = (program: Program, name: string): null | WebGLUniformLocation =>
    gl.getUniformLocation(program.handle, name);
  const line = {
    dim: where(lineProgram, "uDim"),
    dimTo: where(lineProgram, "uDimTo"),
    matrix: where(lineProgram, "uM"),
    res: where(lineProgram, "uRes"),
    slab: where(lineProgram, "uSlab"),
    tone: where(lineProgram, "uTone"),
    width: where(lineProgram, "uWidth"),
  };
  const flat = {
    matrix: where(flatProgram, "uM"),
    round: where(flatProgram, "uRound"),
    scale: where(flatProgram, "uScale"),
    tone: where(flatProgram, "uTone"),
  };
  gl.useProgram(lineProgram.handle);
  gl.uniform3fv(line.tone, tones);
  gl.useProgram(flatProgram.handle);
  gl.uniform3fv(flat.tone, tones);

  gl.bindVertexArray(lineArrays);
  attribute(gl, lineBuffer, 0, 3, strides.line, 0, 1);
  attribute(gl, lineBuffer, 1, 3, strides.line, 3, 1);
  attribute(gl, styleBuffer, 2, 2, strides.lineColor, 0, 1);
  gl.bindVertexArray(triArrays);
  attribute(gl, triBuffer, 0, 3, triVertexFloats, 0, 0);
  attribute(gl, triBuffer, 1, 3, triVertexFloats, 3, 0);
  gl.bindVertexArray(pointArrays);
  attribute(gl, pointBuffer, 0, 3, pointFloats, 0, 0);
  attribute(gl, pointBuffer, 1, 3, pointFloats, 3, 0);
  gl.bindVertexArray(null);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const [pr, pg, pb] = hexBytes(storyPalette.paper);
  gl.clearColor(pr / 255, pg / 255, pb / 255, 1);

  let ratio = 1;
  let cssWidth = 1;
  let cssHeight = 1;
  let faces = new Float32Array(triVertexFloats * 3 * 32);
  const room = new Map<WebGLBuffer, number>();

  const upload = (buffer: WebGLBuffer, data: Float32Array): void => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    if (data.byteLength > (room.get(buffer) ?? 0)) {
      const size = data.byteLength * 2;
      gl.bufferData(gl.ARRAY_BUFFER, size, gl.DYNAMIC_DRAW);
      room.set(buffer, size);
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
  };

  const resize = (): void => {
    ratio = Math.min(globalThis.devicePixelRatio || 1, maxRatio);
    cssWidth = Math.max(1, canvas.clientWidth);
    cssHeight = Math.max(1, canvas.clientHeight);
    const width = Math.max(1, Math.round(cssWidth * ratio));
    const height = Math.max(1, Math.round(cssHeight * ratio));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    gl.viewport(0, 0, width, height);
  };

  const expandFaces = (scene: Scene): number => {
    const count = scene.tris.length / strides.tri;
    const need = count * 3 * triVertexFloats;
    if (faces.length < need) faces = new Float32Array(need * 2);
    for (let i = 0; i < count; i += 1) {
      const toneIndex = scene.triColors[i * strides.triColor] ?? 0;
      const alpha = scene.triColors[i * strides.triColor + 1] ?? 0;
      for (let v = 0; v < 3; v += 1) {
        const from = i * strides.tri + v * 3;
        const to = (i * 3 + v) * triVertexFloats;
        faces[to] = scene.tris[from] ?? 0;
        faces[to + 1] = scene.tris[from + 1] ?? 0;
        faces[to + 2] = scene.tris[from + 2] ?? 0;
        faces[to + 3] = toneIndex;
        faces[to + 4] = alpha;
        faces[to + 5] = 0;
      }
    }
    return count * 3;
  };

  const drawPoints = (
    first: number,
    count: number,
    matrix: Float32Array
  ): void => {
    if (count <= 0) return;
    gl.uniformMatrix4fv(flat.matrix, false, matrix);
    gl.drawArrays(gl.POINTS, first, count);
  };

  const draw = (
    scene: Scene,
    view: Float32Array,
    gridView: Float32Array,
    dim: DimBox | undefined
  ): void => {
    gl.clear(gl.COLOR_BUFFER_BIT);
    const pointCount = scene.points.length / pointFloats;
    const faceVertices = expandFaces(scene);
    const lineCount = scene.lines.length / strides.line;

    gl.useProgram(flatProgram.handle);
    gl.uniform1f(flat.scale, ratio);
    if (pointCount > 0) {
      gl.bindVertexArray(pointArrays);
      upload(pointBuffer, scene.points);
      gl.uniform1f(flat.round, 1);
      drawPoints(0, scene.gridPoints, gridView);
    }
    if (faceVertices > 0) {
      gl.bindVertexArray(triArrays);
      upload(triBuffer, faces.subarray(0, faceVertices * triVertexFloats));
      gl.uniform1f(flat.round, 0);
      gl.uniformMatrix4fv(flat.matrix, false, view);
      gl.drawArrays(gl.TRIANGLES, 0, faceVertices);
    }

    if (lineCount > 0) {
      gl.useProgram(lineProgram.handle);
      gl.bindVertexArray(lineArrays);
      upload(lineBuffer, scene.lines);
      upload(styleBuffer, scene.lineColors);
      gl.uniformMatrix4fv(line.matrix, false, view);
      gl.uniform2f(line.res, cssWidth, cssHeight);
      gl.uniform2f(line.width, 1, 1.25);
      gl.uniform1f(line.slab, scene.slabSegments);
      const sx = canvas.width / cssWidth;
      const sy = canvas.height / cssHeight;
      if (dim) {
        gl.uniform4f(
          line.dim,
          (dim.left + dim.width / 2) * sx,
          (cssHeight - dim.top - dim.height / 2) * sy,
          (dim.width / 2) * sx,
          (dim.height / 2) * sy
        );
        gl.uniform1f(line.dimTo, dimTo);
      } else {
        gl.uniform1f(line.dimTo, 1);
      }
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, lineCount);
    }

    if (pointCount > scene.gridPoints) {
      gl.useProgram(flatProgram.handle);
      gl.bindVertexArray(pointArrays);
      gl.uniform1f(flat.round, 1);
      drawPoints(scene.gridPoints, pointCount - scene.gridPoints, view);
    }
    gl.bindVertexArray(null);
  };

  const dispose = (): void => {
    cleanup();
    lose();
  };

  resize();
  return { dispose, draw, resize };
};
