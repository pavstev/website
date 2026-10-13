export interface UniformSink {
  array: (name: string, data: Float32Array) => void;
  set: (name: string, ...values: number[]) => void;
}

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
