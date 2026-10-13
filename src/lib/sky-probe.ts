import { type UniformSink } from "./corona-layer.ts";

export interface ProbeBox {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export interface SkyProbe {
  columns: number;
  draw: (boxes: Array<ProbeBox | undefined>) => boolean;
  read: () => Uint8Array | undefined;
  rows: number;
  stride: number;
}

const probeColumns = 24;
const probeRows = 6;

export const createSkyProbe = (
  gl: WebGLRenderingContext,
  sink: UniformSink,
  slots: number
): SkyProbe | undefined => {
  const width = probeColumns * slots;
  const texture = gl.createTexture();
  const buffer = gl.createFramebuffer();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    probeRows,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0
  );
  const complete =
    gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!complete) return undefined;
  const pixels = new Uint8Array(width * probeRows * 4);
  return {
    columns: probeColumns,
    draw: (boxes) => {
      if (boxes.every((box) => box === undefined)) return false;
      gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
      for (const [slot, box] of boxes.entries()) {
        if (!box) continue;
        const stepX = (box.right - box.left) / probeColumns;
        const stepY = (box.top - box.bottom) / probeRows;
        gl.viewport(slot * probeColumns, 0, probeColumns, probeRows);
        sink.set(
          "u_probe",
          box.left - slot * probeColumns * stepX,
          box.bottom,
          stepX,
          stepY
        );
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      sink.set("u_probe", 0, 0, 0, 0);
      return true;
    },
    read: () => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
      gl.readPixels(0, 0, width, probeRows, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return gl.isContextLost() ? undefined : pixels;
    },
    rows: probeRows,
    stride: width,
  };
};
