import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import sharp from "sharp";

import { en } from "../src/lib/i18n.ts";
import { iconData } from "../src/lib/icon-data.ts";
import { personalData } from "../src/lib/personal.ts";
import { nightPhase } from "../src/lib/sky-clock.ts";
import { equatorialToWorld, worldToGalactic } from "../src/lib/sky-frame.ts";
import {
  crawlerInstant,
  skyLight,
  viennaLatitude,
  viennaLongitude,
} from "../src/lib/sky-light.ts";
import { planetsAt } from "../src/lib/sky-planets.ts";
import { earthClouds } from "../src/lib/sky-preset.ts";
import {
  cornerCorona,
  cornerMeteor,
  longRaysShader,
} from "../src/lib/sky-rays.ts";
import {
  homeSkyFragmentShader,
  skyVertexShader,
} from "../src/lib/sky-shader.ts";
import { decodeStars } from "../src/lib/sky-stars.ts";
import {
  aimYaw,
  cameraBasis,
  frameAim,
  skyCamera,
} from "../src/lib/sky-view.ts";
import {
  starFragmentShader,
  starPoints,
  starVertexShader,
} from "../src/lib/star-gl.ts";
import { designTokens, hexBytes, profilePalette } from "../src/lib/theme.ts";
import { headerHeight, headerWidth } from "../src/profile/header.ts";

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
  corona: Corona;
  daylight: Daylight;
  extra: readonly Uniform[];
  file: string;
  fragment: string;
  height: number;
  meteor: Meteor;
  stars?: StarPass;
  type: "jpeg" | "png" | "webp";
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
  corona: Corona;
  daylight: Daylight;
  extra: readonly Uniform[];
  fragment: string;
  labPx: number;
  meteor: Meteor;
  stars?: StarPass | undefined;
  time: number;
  vertex: string;
  weather: [number, number, number, number];
}

interface StarPass {
  data: number[];
  fragment: string;
  uniforms: readonly Uniform[];
  vertex: string;
}

const publicDir = "public";
const skyTime = 41;
const cloudTime = 23;
const labPixelsPerCss = 1.2;
const jpegQuality = 88;
const webpQuality = 80;
const crawlerWeather: [number, number, number, number] = [
  earthClouds.cover,
  earthClouds.overcast,
  earthClouds.high,
  earthClouds.fog,
];

type Uniform = readonly [string, readonly number[]];

const noMeteor: Meteor = { angle: 0, progress: 2, x: 0, y: 0 };
const noCorona: Corona = { radius: 0, x: 0, y: 0 };

const crawlerLight = skyLight(crawlerInstant);

const homeCamera = (
  width: number,
  height: number
): { basis: readonly number[]; camera: ReturnType<typeof skyCamera> } => ({
  basis: cameraBasis(
    aimYaw(frameAim(crawlerInstant, viennaLatitude, viennaLongitude), {
      height,
      width,
    }),
    0
  ),
  camera: skyCamera(width, height),
});

const homeUniforms = (width: number, height: number): Uniform[] => {
  const light = crawlerLight;
  const { basis, camera } = homeCamera(width, height);
  return [
    ["u_cam", [camera.top, camera.horizon, camera.eye]],
    ["u_basis", basis],
    ["u_gal", worldToGalactic(crawlerInstant, viennaLatitude, viennaLongitude)],
    ["u_sun", light.sun],
    ["u_sunCol", light.sunColor],
    ["u_sunDisk", light.sunDisk],
    ["u_moon", light.moon],
    ["u_moon2", light.moonShade],
    ["u_moon3", light.moonDisk],
    ["u_moonCol", light.moonColor],
    ["u_wind", [575, 172.5, 1035, 230]],
    ["u_ground", [0, 0]],
    ["u_wpuff", Array.from({ length: 24 }, () => 0)],
    ["u_txt", Array.from({ length: 12 }, () => 0)],
  ];
};

const homeStars = (width: number, height: number): StarPass => {
  const { basis, camera } = homeCamera(width, height);
  return {
    data: [...starPoints(decodeStars(), planetsAt(crawlerInstant))],
    fragment: starFragmentShader,
    uniforms: [
      [
        "u_eq",
        equatorialToWorld(crawlerInstant, viennaLatitude, viennaLongitude),
      ],
      ["u_basis", basis],
      ["u_cam", [camera.top, camera.horizon, camera.eye]],
      ["u_res", [width, height]],
      ["u_sun", crawlerLight.sun],
      ["u_moon", crawlerLight.moon],
      ["u_moonSky", [Math.min(1, crawlerLight.moonColor[0] * 25)]],
      ["u_day", [nightPhase.day]],
      ["u_time", [skyTime]],
      ["u_px", [1]],
    ],
    vertex: starVertexShader,
  };
};

const rgba = (hex: string, alpha: number): string =>
  `rgba(${[...hexBytes(hex), alpha].join(", ")})`;

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
  const { corona } = input;
  gl.viewport(0, 0, width, height);
  gl.uniform2f(at("u_res"), width, height);
  gl.uniform1f(at("u_view"), height);
  gl.uniform1f(at("u_labPx"), input.labPx);
  gl.uniform1f(at("u_time"), input.time);
  gl.uniform2f(at("u_pointer"), 0, 0);
  gl.uniform3f(at("u_portrait"), corona.x, height - corona.y, corona.radius);
  gl.uniform4f(
    at("u_meteor"),
    input.meteor.x,
    input.meteor.y,
    input.meteor.angle,
    input.meteor.progress
  );
  gl.uniform1f(at("u_clouds"), 1);
  gl.uniform1f(at("u_cloudTime"), input.cloudTime);
  gl.uniform1f(at("u_cloudShift"), input.cloudTime);
  gl.uniform4f(at("u_weather"), ...input.weather);
  gl.uniform4f(at("u_fall"), 0, 0, 0, 0);
  gl.uniform1f(at("u_puffOn"), 0);
  gl.uniform3f(
    at("u_daylight"),
    input.daylight.day,
    input.daylight.twilight,
    input.daylight.dusk
  );
  const setUniform = (
    location: null | WebGLUniformLocation,
    values: readonly number[]
  ): void => {
    const [a = 0, b = 0, c = 0, d = 0] = values;
    switch (values.length) {
      case 1: {
        gl.uniform1f(location, a);
        return;
      }
      case 2: {
        gl.uniform2f(location, a, b);
        return;
      }
      case 3: {
        gl.uniform3f(location, a, b, c);
        return;
      }
      case 4: {
        gl.uniform4f(location, a, b, c, d);
        return;
      }
      case 9: {
        gl.uniformMatrix3fv(location, false, new Float32Array(values));
        return;
      }
      default: {
        gl.uniform4fv(location, new Float32Array(values));
      }
    }
  };
  const apply = (
    where: (name: string) => null | WebGLUniformLocation,
    list: readonly Uniform[]
  ): void => {
    for (const [uniform, values] of list) setUniform(where(uniform), values);
  };
  apply(at, input.extra);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  const { stars } = input;
  if (stars) {
    gl.disableVertexAttribArray(position);
    const starProgram = gl.createProgram();
    gl.attachShader(starProgram, compile(gl.VERTEX_SHADER, stars.vertex));
    gl.attachShader(starProgram, compile(gl.FRAGMENT_SHADER, stars.fragment));
    gl.linkProgram(starProgram);
    if (!gl.getProgramParameter(starProgram, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(starProgram) ?? "Link failed");
    gl.useProgram(starProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(stars.data),
      gl.STATIC_DRAW
    );
    let offset = 0;
    for (const [attribute, size] of [
      ["a_dir", 3],
      ["a_mag", 1],
      ["a_col", 3],
      ["a_twinkle", 1],
    ] as const) {
      const location = gl.getAttribLocation(starProgram, attribute);
      if (location >= 0) {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, 32, offset * 4);
      }
      offset += size;
    }
    apply(
      (uniform) => gl.getUniformLocation(starProgram, uniform),
      stars.uniforms
    );
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArrays(gl.POINTS, 0, stars.data.length / 8);
  }
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
    extra: spec.extra,
    fragment: spec.fragment,
    labPx: labPixelsPerCss,
    meteor: spec.meteor,
    stars: spec.stars,
    time: skyTime,
    vertex: skyVertexShader,
    weather: crawlerWeather,
  });
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
    body: ogBody(portrait),
    corona: noCorona,
    daylight: nightPhase,
    extra: homeUniforms(1200, 630),
    file: path.join(publicDir, "og-image.jpg"),
    fragment: homeSkyFragmentShader,
    height: 630,
    meteor: noMeteor,
    stars: homeStars(1200, 630),
    type: "jpeg",
    width: 1200,
  },
  {
    body: "",
    corona: cornerCorona(396),
    daylight: nightPhase,
    extra: [],
    file: path.join(publicDir, "linkedin-cover.png"),
    fragment: longRaysShader,
    height: 396,
    meteor: { ...cornerMeteor, progress: 0.55 },
    type: "png",
    width: 1584,
  },
  {
    body: "",
    corona: cornerCorona(headerHeight),
    daylight: nightPhase,
    extra: [],
    file: path.join("src", "profile", "header-sky.webp"),
    fragment: longRaysShader,
    height: headerHeight,
    meteor: { ...cornerMeteor, progress: 0.55, x: -2.1, y: 0.32 },
    type: "webp",
    width: headerWidth,
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
