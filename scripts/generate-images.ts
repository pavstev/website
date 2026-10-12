import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

import { en } from "../src/lib/i18n.ts";
import { iconData } from "../src/lib/icon-data.ts";
import { personalData } from "../src/lib/personal.ts";
import { skyFragmentShader, skyVertexShader } from "../src/lib/sky-shader.ts";
import { designTokens, profilePalette } from "../src/lib/theme.ts";

interface Corona {
  radius: number;
  x: number;
  y: number;
}

interface Daylight {
  day: number;
  dusk: number;
  twilight: number;
}

interface ImageSpec {
  body: string;
  corona: Corona | string;
  daylight: Daylight;
  file: string;
  fragment: string;
  height: number;
  meteor: Meteor;
  type: "jpeg" | "png";
  width: number;
}

interface Meteor {
  angle: number;
  progress: number;
  x: number;
  y: number;
}

interface SkyInput {
  cloudTime: number;
  corona: Corona | string;
  daylight: Daylight;
  fragment: string;
  labPx: number;
  meteor: Meteor;
  ripple: number;
  time: number;
  vertex: string;
}

const publicDir = "public";
const skyTime = 41;
const cloudTime = 23;
const labPixelsPerCss = 1.2;
const rippleLife = 1.6;
const jpegQuality = 88;

const noMeteor: Meteor = { angle: 0, progress: 2, x: 0, y: 0 };

const longRays: Array<[string, string]> = [
  ["const float coronaSize = 0.48;", "const float coronaSize = 1.60;"],
  ["const float coronaBright = 1.06;", "const float coronaBright = 1.30;"],
];

const patchShader = (
  shader: string,
  swaps: Array<[string, string]>
): string => {
  let source = shader;
  for (const [from, to] of swaps) {
    if (!source.includes(from))
      throw new Error(`The sky shader no longer holds: ${from}`);
    source = source.replace(from, () => to);
  }
  return source;
};

const rgba = (hex: string, alpha: number): string => {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${[(value >> 16) & 255, (value >> 8) & 255, value & 255, alpha].join(", ")})`;
};

const shade = (alpha: number): string => rgba(designTokens.background, alpha);

const dataUrl = async (file: string, mime: string): Promise<string> => {
  const bytes = await readFile(file);
  return `data:${mime};base64,${bytes.toString("base64")}`;
};

const fontFaces = async (): Promise<string> => {
  const css = await readFile("src/styles/globals.css", "utf8");
  const faces = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
  const wanted = faces.filter(
    (face) => face.includes('"Inter Variable"') || face.includes('"Geist"')
  );
  const inlined = await Promise.all(
    wanted.map(async (face) => {
      const url = /url\("\/(fonts\/[^"]+)"\)/.exec(face)?.[1];
      if (!url) throw new Error("A font face has no local url");
      const data = await dataUrl(path.join(publicDir, url), "font/woff2");
      return face.replace(`/${url}`, () => data);
    })
  );
  if (inlined.length !== 4) throw new Error("Expected four font faces");
  return inlined.join("\n");
};

const flagSvg = (size: number): string => {
  const flag = iconData["circle-flags:at"];
  if (!flag) throw new Error("The Austrian flag is missing from icon-data");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(size)}" height="${String(size)}" viewBox="0 0 ${String(flag.width)} ${String(flag.height)}" style="filter: drop-shadow(0 1px 3px ${shade(0.55)})">${flag.body}</svg>`;
};

const escapeHtml = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const place = escapeHtml(
  en.socialImages.place
    .replace("{city}", () => personalData.city)
    .replace("{country}", () => personalData.country)
);
const name = escapeHtml(personalData.name);
const title = escapeHtml(personalData.title);

const ogBody = (portrait: string): string => `
<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:64px">
  <div style="width:260px;height:260px;border-radius:50%;padding:10px;box-sizing:border-box;box-shadow:0 0 0 1px ${rgba(profilePalette.ring, 0.22)},0 0 60px ${rgba(profilePalette.sky.blue, 0.25)}">
    <img id="portrait" src="${portrait}" style="display:block;width:100%;height:100%;border-radius:50%;object-fit:cover;object-position:top">
  </div>
  <div style="display:flex;flex-direction:column;gap:18px;max-width:760px">
    <div style="font-family:Geist;font-size:76px;font-weight:600;letter-spacing:0.02em;line-height:1;padding-block:0.08em;color:${profilePalette.ring};text-shadow:0 0 30px ${shade(0.9)}">${name}</div>
    <div style="font-size:27px;font-weight:400;white-space:nowrap;color:${profilePalette.glyph};text-shadow:0 0 18px ${shade(0.9)}">${title}</div>
    <div style="display:flex;align-items:center;gap:12px;font-size:28px;font-weight:300;color:${profilePalette.glyph};text-shadow:0 0 18px ${shade(0.9)}">${place} ${flagSvg(28)}</div>
  </div>
</div>`;

const waitForAssets = async (): Promise<void> => {
  await document.fonts.ready;
  await Promise.all([...document.images].map(async (image) => image.decode()));
};

const drawSky = (input: SkyInput): void => {
  const canvas = document.querySelector("canvas");
  const gl = canvas?.getContext("webgl", { preserveDrawingBuffer: true });
  if (!canvas || !gl) throw new Error("No WebGL context");
  const compile = (type: number, source: string): WebGLShader => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("No shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(shader) ?? "Shader failed");
    return shader;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, input.vertex));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, input.fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(program) ?? "Link failed");
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW
  );
  const position = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const at = (uniform: string): null | WebGLUniformLocation =>
    gl.getUniformLocation(program, uniform);
  const { height, width } = canvas;
  const measure = (selector: string): Corona => {
    const node = document.querySelector(selector);
    if (!node) throw new Error("No portrait to center the corona on");
    const face = node.getBoundingClientRect();
    return {
      radius: face.width / 2,
      x: face.left + face.width / 2,
      y: face.top + face.height / 2,
    };
  };
  const corona =
    typeof input.corona === "string" ? measure(input.corona) : input.corona;
  gl.viewport(0, 0, width, height);
  gl.uniform2f(at("u_res"), width, height);
  gl.uniform1f(at("u_view"), height);
  gl.uniform1f(at("u_labPx"), input.labPx);
  gl.uniform1f(at("u_time"), input.time);
  gl.uniform2f(at("u_pointer"), 0, 0);
  gl.uniform3f(at("u_portrait"), corona.x, height - corona.y, corona.radius);
  gl.uniform3f(at("u_ripple"), 0, 0, input.ripple);
  gl.uniform4f(
    at("u_meteor"),
    input.meteor.x,
    input.meteor.y,
    input.meteor.angle,
    input.meteor.progress
  );
  gl.uniform1f(at("u_clouds"), 1);
  gl.uniform1f(at("u_cloudTime"), input.cloudTime);
  gl.uniform3f(
    at("u_daylight"),
    input.daylight.day,
    input.daylight.twilight,
    input.daylight.dusk
  );
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.finish();
};

const render = async (
  page: Awaited<
    ReturnType<Awaited<ReturnType<typeof chromium.launch>>["newPage"]>
  >,
  spec: ImageSpec,
  faces: string
): Promise<Buffer> => {
  await page.setViewportSize({ height: spec.height, width: spec.width });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
${faces}
html,body{margin:0;width:${String(spec.width)}px;height:${String(spec.height)}px;overflow:hidden;background:${designTokens.background}}
body{position:relative;font-family:"Inter Variable",sans-serif;-webkit-font-smoothing:antialiased}
canvas{position:absolute;inset:0;width:100%;height:100%}
</style></head><body><canvas width="${String(spec.width)}" height="${String(spec.height)}"></canvas>${spec.body}</body></html>`);
  await page.evaluate(waitForAssets);
  await page.evaluate(drawSky, {
    cloudTime,
    corona: spec.corona,
    daylight: spec.daylight,
    fragment: spec.fragment,
    labPx: labPixelsPerCss,
    meteor: spec.meteor,
    ripple: rippleLife,
    time: skyTime,
    vertex: skyVertexShader,
  });
  return spec.type === "jpeg"
    ? page.screenshot({ quality: jpegQuality, type: "jpeg" })
    : page.screenshot({ type: "png" });
};

const writeIfChanged = async (
  file: string,
  bytes: Buffer
): Promise<boolean> => {
  let old = Buffer.alloc(0);
  try {
    old = await readFile(file);
  } catch {
    old = Buffer.alloc(0);
  }
  if (old.equals(bytes)) return false;
  await writeFile(file, bytes);
  return true;
};

const started = performance.now();
const portrait = await dataUrl(
  path.join(publicDir, personalData.portrait.url),
  "image/webp"
);
const specs: ImageSpec[] = [
  {
    body: ogBody(portrait),
    corona: "#portrait",
    daylight: { day: 0, dusk: 0, twilight: 0 },
    file: path.join(publicDir, "og-image.jpg"),
    fragment: skyFragmentShader,
    height: 630,
    meteor: noMeteor,
    type: "jpeg",
    width: 1200,
  },
  {
    body: "",
    corona: { radius: 170, x: -170, y: -170 },
    daylight: { day: 0, dusk: 0, twilight: 0 },
    file: path.join(publicDir, "linkedin-cover.png"),
    fragment: patchShader(skyFragmentShader, longRays),
    height: 396,
    meteor: { angle: -0.4, progress: 0.55, x: 0.3, y: 0.38 },
    type: "png",
    width: 1584,
  },
];

const faces = await fontFaces();
const browser = await chromium.launch({
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
  ],
  channel: "chrome",
  headless: true,
});
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const spec of specs) {
    const passes = await Array.fromAsync([1, 2], async () =>
      render(page, spec, faces)
    );
    const [bytes, again] = passes;
    if (!bytes || !again || !bytes.equals(again))
      throw new Error(`${spec.file} differs between two renders`);
    const changed = await writeIfChanged(spec.file, bytes);
    console.warn(
      `${changed ? "Updated" : "Unchanged"} ${spec.file} (${String(spec.width)}x${String(spec.height)}, ${String(Math.round(bytes.length / 1024))} KB)`
    );
  }
} finally {
  await browser.close();
}
console.warn(`Done in ${((performance.now() - started) / 1000).toFixed(1)} s`);
