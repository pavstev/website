import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import sharp from "sharp";

import { sceneCounts } from "../src/data/dotfiles-story.ts";
import { getDotfilesFacts } from "../src/lib/dotfiles-facts.ts";
import { en } from "../src/lib/i18n.ts";
import { personalData } from "../src/lib/personal.ts";
import {
  haloLit,
  haloPulse,
  outlineAlpha,
  rimCells,
} from "../src/lib/portrait-dither.ts";
import {
  paintCloudShader,
  paintSkyShader,
} from "../src/lib/sky-paint-shader.ts";
import {
  nightScene,
  type PaintScene,
  spaceBand,
} from "../src/lib/sky-paint.ts";
import { meteorStart, rayView } from "../src/lib/sky-rays.ts";
import { skyVertexShader } from "../src/lib/sky-shader.ts";
import {
  type SceneCounts,
  toneNames,
} from "../src/lib/story/blueprint-geometry.ts";
import { posterSvg } from "../src/lib/story/blueprint-svg.ts";
import {
  designTokens,
  ditherOutline,
  ditherTones,
  hexBytes,
  profilePalette,
  storyPalette,
} from "../src/lib/theme.ts";
import { nightWeather } from "../src/lib/weather.ts";

interface ImageSpec {
  background: string;
  body: string;
  file: string;
  height: number;
  meteor: number;
  sky: boolean;
  type: "jpeg" | "png" | "webp";
  width: number;
}

interface SkyInput {
  band: number;
  cloudCell: number;
  cloudSource: string;
  height: number;
  meteor: number[];
  meteorScale: number;
  paintSource: string;
  scene: PaintScene;
  time: number;
  vertex: string;
  width: number;
  wind: number;
}

const publicDir = "public";
const skyTime = 41;
const windSeconds = 90;
const cloudCell = 2;
const noMeteor = 2;
const jpegQuality = 88;
const webpQuality = 80;

const textShade = `rgba(${[...hexBytes(designTokens.background), 0.9].join(", ")})`;

const dataUrl = async (file: string, mime: string): Promise<string> => {
  const bytes = await readFile(file);
  return `data:${mime};base64,${bytes.toString("base64")}`;
};

const fontFaces = async (): Promise<string> => {
  const css = await readFile("src/styles/globals.css", "utf8");
  const faces = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
  const wanted = faces.filter(
    (face) =>
      face.includes('"Geist Variable"') ||
      face.includes('"Geist"') ||
      face.includes("geist-mono-latin-400")
  );
  const inlined = await Promise.all(
    wanted.map(async (face) => {
      const url = /url\("\/(fonts\/[^"]+)"\)/.exec(face)?.[1];
      if (!url) throw new Error("A font face has no local url");
      const data = await dataUrl(path.join(publicDir, url), "font/woff2");
      return face.replace(`/${url}`, () => data);
    })
  );
  if (inlined.length !== 5) throw new Error("Expected five font faces");
  return inlined.join("\n");
};

const escapeHtml = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const photoPx = 240;
const rimCellScale = 2;

const square = (x: number, y: number, size: number, alpha?: number): string =>
  `<rect x="${String(x)}" y="${String(y)}" width="${String(size)}" height="${String(size)}"${alpha === undefined ? "" : ` fill-opacity="${alpha.toFixed(3)}"`}/>`;

const pixelRim = (): string => {
  const cells = rimCells(photoPx, 1, rimCellScale);
  const halo = Array.from(cells.x, (x, index) =>
    haloLit(
      cells.falloff[index] ?? 0,
      haloPulse(0, cells.depth[index] ?? 0),
      cells.threshold[index] ?? 1
    )
      ? square(x, cells.y[index] ?? 0, cells.size, cells.alpha[index] ?? 0)
      : ""
  ).join("");
  const outline = Array.from(cells.edgeX, (x, index) =>
    square(x, cells.edgeY[index] ?? 0, cells.size)
  ).join("");
  const offset = String(-cells.margin);
  return `<svg width="${String(cells.side)}" height="${String(cells.side)}" shape-rendering="crispEdges" style="position:absolute;left:${offset}px;top:${offset}px"><g fill="${ditherTones[2]}">${halo}</g><g fill="${ditherOutline}" fill-opacity="${String(outlineAlpha)}">${outline}</g></svg>`;
};

const name = escapeHtml(personalData.name);
const title = escapeHtml(personalData.title);

const ogBody = (portrait: string): string => `
<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:64px">
  <div style="position:relative;width:${String(photoPx)}px;height:${String(photoPx)}px;margin:10px">
    <img id="portrait" src="${portrait}" style="display:block;width:100%;height:100%;border-radius:50%;object-fit:cover;object-position:top">
    ${pixelRim()}
  </div>
  <div style="display:flex;flex-direction:column;gap:18px;max-width:760px">
    <div style="font-family:Geist;font-size:76px;font-weight:600;letter-spacing:0.02em;line-height:1;padding-block:0.08em;color:${profilePalette.ring};text-shadow:0 0 30px ${textShade}">${name}</div>
    <div style="font-size:27px;font-weight:400;white-space:nowrap;color:${profilePalette.glyph};text-shadow:0 0 18px ${textShade}">${title}</div>
  </div>
</div>`;

const storyWidth = 1200;
const storyHeight = 630;

const site = escapeHtml(new URL(personalData.website).host);

const badgePx = 64;

const badgeUrl = async (file: string): Promise<string> => {
  const bytes = await sharp(file)
    .resize(badgePx, badgePx, { fit: "cover", position: "top" })
    .png()
    .toBuffer();
  return `data:image/png;base64,${bytes.toString("base64")}`;
};

const drawnBy = (badge: string): string => `
  <div style="position:absolute;left:72px;top:64px;display:flex;flex-direction:column;gap:14px">
    <div style="font-family:'Geist Mono';font-size:15px;letter-spacing:0.1em;text-transform:uppercase;color:${storyPalette.muted}">${escapeHtml(en.story.drawnBy)}</div>
    <div style="display:flex;align-items:center;gap:18px">
      <img src="${badge}" style="display:block;width:${String(badgePx)}px;height:${String(badgePx)}px;border-radius:50%;border:1px solid ${storyPalette.line}">
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="font-family:Geist;font-size:30px;font-weight:600;letter-spacing:-0.01em;line-height:1;color:${storyPalette.ink}">${name}</div>
        <div style="font-family:'Geist Mono';font-size:17px;line-height:1;color:${storyPalette.muted}">${site}</div>
      </div>
    </div>
  </div>`;

const storyBody = (counts: SceneCounts, badge: string): string => `
<style>${toneNames
  .filter((tone) => tone !== "ink")
  .map((tone) => `.tone-${tone}{color:${storyPalette[tone]}}`)
  .join("")}</style>
<div style="position:absolute;inset:0;color:${storyPalette.ink}">
  ${posterSvg(storyWidth, storyHeight, counts).replace("<svg ", '<svg style="position:absolute;inset:0" ')}
  ${drawnBy(badge)}
  <div style="position:absolute;left:72px;bottom:56px;font-family:Geist;font-size:132px;font-weight:600;letter-spacing:-0.03em;line-height:1;color:${storyPalette.ink}">${escapeHtml(en.story.crumb)}</div>
</div>`;

const waitForAssets = async (): Promise<void> => {
  await Promise.all([...document.fonts].map(async (face) => face.load()));
  await document.fonts.ready;
  await Promise.all([...document.images].map(async (image) => image.decode()));
};

const drawSky = (input: SkyInput): void => {
  const canvas = document.querySelector("canvas");
  const gl = canvas?.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    preserveDrawingBuffer: true,
    stencil: false,
  });
  if (!canvas || !gl) throw new Error("No WebGL context");
  const positionSlot = 0;
  const compile = (type: number, source: string): WebGLShader => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("No shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(shader) ?? "Shader failed");
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, input.vertex);
  const link = (source: string): WebGLProgram => {
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, source));
    gl.bindAttribLocation(program, positionSlot, "a_pos");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(program) ?? "Link failed");
    return program;
  };
  const cloud = link(input.cloudSource);
  const paint = link(input.paintSource);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(positionSlot);
  gl.vertexAttribPointer(positionSlot, 2, gl.FLOAT, false, 0, 0);
  const setter =
    (program: WebGLProgram) =>
    (uniform: string, ...values: number[]): void => {
      const at = gl.getUniformLocation(program, uniform);
      const [a = 0, b = 0, c = 0, d = 0] = values;
      switch (values.length) {
        case 1: {
          gl.uniform1f(at, a);
          break;
        }
        case 2: {
          gl.uniform2f(at, a, b);
          break;
        }
        case 3: {
          gl.uniform3f(at, a, b, c);
          break;
        }
        default: {
          gl.uniform4f(at, a, b, c, d);
        }
      }
    };
  const { height, scene, width } = input;
  const uploadScene = (set: ReturnType<typeof setter>): void => {
    set("u_cumulus", scene.cumulus);
    set("u_alto", scene.alto);
    set("u_cirrus", scene.cirrus);
    set("u_top", ...scene.top);
    set("u_mid", ...scene.mid);
    set("u_low", ...scene.low);
    set("u_lit", ...scene.lit);
    set("u_shade", ...scene.shade);
    set("u_sunCol", ...scene.sunColor);
    set("u_sun", ...scene.sun);
    set("u_sunUp", scene.sunUp);
    set("u_glow", scene.glow);
    set("u_ov", scene.overcast);
    set("u_moon", ...scene.moon);
    set("u_moonCol", ...scene.moonColor);
    set("u_moonGlow", scene.moonGlow);
    set("u_band", input.band);
    set("u_space", ...scene.spaceColor);
    set("u_lutMix", scene.lutMix);
    set("u_grey", scene.grey);
    set("u_res", width, height);
    set("u_time", input.time);
    set("u_wind", input.wind);
  };

  const cloudWidth = Math.ceil(width / input.cloudCell);
  const cloudHeight = Math.ceil(height / input.cloudCell);
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    cloudWidth,
    cloudHeight,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const buffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0
  );
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
    throw new Error("The cloud target is incomplete");

  gl.useProgram(cloud);
  const setCloud = setter(cloud);
  uploadScene(setCloud);
  setCloud("u_light", ...scene.light);
  setCloud("u_lightCol", ...scene.lightColor);
  setCloud("u_firstLayer", 0);
  setCloud("u_cell", input.cloudCell);
  gl.viewport(0, 0, cloudWidth, cloudHeight);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, width, height);

  gl.useProgram(paint);
  const setPaint = setter(paint);
  uploadScene(setPaint);
  setPaint("u_stars", scene.stars);
  setPaint("u_starGate", 1);
  setPaint("u_haze", scene.haze);
  setPaint("u_rain", scene.rain);
  setPaint("u_snow", scene.snow);
  setPaint("u_fog", scene.fog);
  setPaint("u_moonL", ...scene.moonLight);
  setPaint("u_moonN", ...scene.moonNorth);
  setPaint("u_earth", scene.earth);
  setPaint("u_moonTint", ...scene.moonTint);
  setPaint("u_aura", scene.aura);
  setPaint("u_px", 1);
  setPaint("u_cell", input.cloudCell);
  setPaint("u_cloudRes", cloudWidth, cloudHeight);
  setPaint("u_corona", ...scene.corona);
  setPaint("u_coronaCol", ...scene.lightColor);
  gl.uniform1i(gl.getUniformLocation(paint, "u_clouds"), 1);
  setPaint("u_floor", 0);
  setPaint("u_still", 0);
  setPaint("u_clear", 0, 0, 0, 0);
  setPaint("u_cloudOn", 1);
  setPaint("u_mapOn", 0);
  setPaint("u_moonFace", 0);
  setPaint("u_meteor", ...input.meteor);
  setPaint("u_meteorScale", input.meteorScale);
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
html,body{margin:0;width:${String(spec.width)}px;height:${String(spec.height)}px;overflow:hidden;background:${spec.background}}
body{position:relative;font-family:"Geist Variable",sans-serif;-webkit-font-smoothing:antialiased}
canvas{position:absolute;inset:0;width:100%;height:100%}
</style></head><body>${spec.sky ? `<canvas width="${String(spec.width)}" height="${String(spec.height)}"></canvas>` : ""}${spec.body}</body></html>`);
  await page.evaluate(waitForAssets);
  if (spec.sky) {
    const scene = nightScene(
      { height: spec.height, width: spec.width },
      nightWeather
    );
    const view = rayView(spec.height);
    const start = meteorStart(spec.width, spec.height, view);
    await page.evaluate(drawSky, {
      band: spaceBand,
      cloudCell,
      cloudSource: paintCloudShader,
      height: spec.height,
      meteor: [start.x, start.y, start.angle, spec.meteor],
      meteorScale: view,
      paintSource: paintSkyShader,
      scene,
      time: skyTime,
      vertex: skyVertexShader,
      width: spec.width,
      wind: scene.drift * windSeconds,
    });
  }
  if (spec.type === "jpeg")
    return page.screenshot({ quality: jpegQuality, type: "jpeg" });
  const png = await page.screenshot({ type: "png" });
  return spec.type === "png"
    ? png
    : sharp(png).webp({ effort: 6, quality: webpQuality }).toBuffer();
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
    background: designTokens.background,
    body: ogBody(portrait),
    file: path.join(publicDir, "og-image.jpg"),
    height: 630,
    meteor: noMeteor,
    sky: true,
    type: "jpeg",
    width: 1200,
  },
  {
    background: designTokens.background,
    body: "",
    file: path.join(publicDir, "linkedin-cover.png"),
    height: 396,
    meteor: 0.55,
    sky: true,
    type: "png",
    width: 1584,
  },
  {
    background: storyPalette.paper,
    body: storyBody(
      sceneCounts(await getDotfilesFacts()),
      await badgeUrl(path.join(publicDir, personalData.portrait.url))
    ),
    file: path.join(publicDir, "og-dotfiles.jpg"),
    height: 630,
    meteor: 0,
    sky: false,
    type: "jpeg",
    width: 1200,
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
