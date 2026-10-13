import { createFramePacer } from "@/lib/frame-pacer";
import { orthographic } from "@/lib/planet-gl";
import { isSoftwareRenderer } from "@/lib/webgl";

export interface PlanetGl {
  gl: WebGL2RenderingContext;
  loseContext: () => void;
}

export interface PlanetStage {
  frozen: boolean;
  height: number;
  markActive: () => void;
  pixelRatio: number;
  projection: Float32Array;
  resize: () => void;
  running: () => boolean;
  start: () => void;
  stop: () => void;
  width: number;
}

interface StageOptions {
  advance: (dt: number) => void;
  canvas: HTMLCanvasElement;
  draw: () => void;
  far: number;
  frameMs: number;
  maxPixelRatio: number;
  near: number;
  onFreeze: () => void;
  onResize?: () => void;
  stage: HTMLElement;
}

export const openPlanetGl = (canvas: HTMLCanvasElement): PlanetGl => {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: true,
    depth: true,
    powerPreference: "low-power",
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    stencil: false,
  });
  if (!gl) throw new Error("webgl2 unavailable");
  const loseContext = (): void => {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };
  if (isSoftwareRenderer(gl)) {
    loseContext();
    throw new Error("software renderer");
  }
  return { gl, loseContext };
};

export const clearFrame = (
  gl: WebGL2RenderingContext,
  width: number,
  height: number
): void => {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clearDepth(1);
  gl.depthMask(true);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.frontFace(gl.CCW);
  gl.cullFace(gl.BACK);
  gl.enable(gl.CULL_FACE);
  gl.disable(gl.BLEND);
};

export const createPlanetStage = ({
  advance,
  canvas,
  draw,
  far,
  frameMs,
  maxPixelRatio,
  near,
  onFreeze,
  onResize,
  stage,
}: StageOptions): PlanetStage => {
  let handle = 0;
  const view: PlanetStage = {
    frozen: false,
    height: 1,
    markActive: (): void => {
      pacer.markActive();
    },
    pixelRatio: Math.min(globalThis.devicePixelRatio || 1, maxPixelRatio),
    projection: orthographic(1, 1, near, far),
    resize: (): void => {
      view.width = Math.max(1, stage.clientWidth);
      view.height = Math.max(1, stage.clientHeight);
      canvas.width = Math.floor(view.width * view.pixelRatio);
      canvas.height = Math.floor(view.height * view.pixelRatio);
      view.projection = orthographic(view.width, view.height, near, far);
      onResize?.();
    },
    running: (): boolean => handle !== 0,
    start: (): void => {
      handle = requestAnimationFrame(loop);
    },
    stop: (): void => {
      if (handle !== 0) cancelAnimationFrame(handle);
      handle = 0;
      pacer.reset();
    },
    width: 1,
  };

  const pacer = createFramePacer({
    activeFrameMs: frameMs,
    canDowngrade: () => view.pixelRatio > 1,
    downgrade: () => {
      view.pixelRatio = 1;
      view.resize();
    },
  });

  const loop = (now: number): void => {
    handle = requestAnimationFrame(loop);
    const step = pacer.step(now);
    if (step.kind === "freeze") {
      view.frozen = true;
      onFreeze();
      return;
    }
    if (step.kind !== "draw") return;
    advance(step.dt);
    draw();
  };

  return view;
};
