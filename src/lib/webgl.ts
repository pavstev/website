const softwarePattern = /swiftshader|llvmpipe|softpipe|software|basic render/i;

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
