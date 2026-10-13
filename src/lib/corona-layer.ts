export interface LayerInput {
  face: Box;
  pitchX: number;
  pitchY: number;
  previous: LayerPlacement | undefined;
  reach: number;
  sky: Box;
  stage: Box;
}

export interface LayerPlacement {
  cssHeight: number;
  cssWidth: number;
  height: number;
  key: string;
  left: number;
  originX: number;
  originY: number;
  scrollTop: number;
  top: number;
  width: number;
}

export interface UniformSink {
  array: (name: string, data: Float32Array) => void;
  set: (name: string, ...values: number[]) => void;
}

interface Box {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

const bufferStep = 32;
const keyGrid = 64;

const roundUp = (value: number): number =>
  Math.max(bufferStep, Math.ceil(value / bufferStep) * bufferStep);

export const placeLayer = ({
  face,
  pitchX,
  pitchY,
  previous,
  reach,
  sky,
  stage,
}: LayerInput): LayerPlacement | undefined => {
  const radius = (face.right - face.left) / 2;
  if (radius <= 0 || pitchX <= 0 || pitchY <= 0) return undefined;
  const centerX = (face.left + face.right) / 2;
  const centerY = (face.top + face.bottom) / 2;
  const half = radius * reach;
  const left = Math.max(centerX - half, stage.left);
  const right = Math.min(centerX + half, stage.right);
  const top = Math.max(centerY - half, stage.top);
  const bottom = Math.min(centerY + half, stage.bottom);
  if (right <= left || bottom <= top) return undefined;
  const key = [
    centerX - stage.left,
    centerY - stage.top,
    radius,
    stage.right - stage.left,
    stage.bottom - stage.top,
    pitchX,
    pitchY,
  ]
    .map((value) => Math.round(value * keyGrid) / keyGrid)
    .join(" ");
  const scrollTop = sky.top - stage.top;
  if (previous?.key === key && previous.scrollTop !== scrollTop) {
    return {
      ...previous,
      originX: (stage.left + previous.left - sky.left) * pitchX,
      originY:
        (sky.bottom - stage.top - previous.top - previous.cssHeight) * pitchY,
      scrollTop,
    };
  }
  const startX = Math.floor((left - sky.left) * pitchX);
  const endX = Math.ceil((right - sky.left) * pitchX);
  const startY = Math.floor((sky.bottom - bottom) * pitchY);
  const endY = Math.ceil((sky.bottom - top) * pitchY);
  const width = roundUp(endX - startX);
  const height = roundUp(endY - startY);
  const cssHeight = height / pitchY;
  return {
    cssHeight,
    cssWidth: width / pitchX,
    height,
    key,
    left: sky.left + startX / pitchX - stage.left,
    originX: startX,
    originY: startY,
    scrollTop,
    top: sky.bottom - startY / pitchY - cssHeight - stage.top,
    width,
  };
};

const uniformLocation = (
  gl: WebGLRenderingContext,
  program: WebGLProgram
): ((name: string) => null | WebGLUniformLocation) => {
  const cache = new Map<string, null | WebGLUniformLocation>();
  return (name) => {
    const known = cache.get(name);
    if (known !== undefined) return known;
    const location = gl.getUniformLocation(program, name);
    cache.set(name, location);
    return location;
  };
};

export const createUniformSink = (
  gl: WebGLRenderingContext,
  program: WebGLProgram
): UniformSink => {
  const at = uniformLocation(gl, program);
  return {
    array: (name, data) => {
      gl.uniform4fv(at(name), data);
    },
    set: (name, ...values) => {
      const location = at(name);
      const [a = 0, b = 0, c = 0, d = 0] = values;
      switch (values.length) {
        case 1: {
          gl.uniform1f(location, a);
          break;
        }
        case 2: {
          gl.uniform2f(location, a, b);
          break;
        }
        case 3: {
          gl.uniform3f(location, a, b, c);
          break;
        }
        default: {
          gl.uniform4f(location, a, b, c, d);
        }
      }
    },
  };
};

export const fanOut = (
  sinks: Array<() => undefined | UniformSink>
): UniformSink => ({
  array: (name, data) => {
    for (const sink of sinks) sink()?.array(name, data);
  },
  set: (name, ...values) => {
    for (const sink of sinks) sink()?.set(name, ...values);
  },
});
