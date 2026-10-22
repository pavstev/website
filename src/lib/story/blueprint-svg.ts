import {
  dotDepthFade,
  dotGain,
  dotPitch,
  dotRadius,
  dotSpacingFade,
} from "./blueprint-dots.ts";
import {
  buildScene,
  frameMatrix,
  project,
  type Scene,
  type SceneCounts,
  strides,
  toneNames,
} from "./blueprint-geometry.ts";

const fmt = (n: number): string => n.toFixed(1);

const escapeText = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const toneClass = (index: number): string => {
  const name = toneNames[index] ?? "ink";
  return name === "ink" ? "" : ` class="tone-${name}"`;
};

const group = (
  groups: Map<string, string[]>,
  tone: number,
  alpha: number,
  piece: string
): void => {
  const key = `${String(tone)}:${alpha.toFixed(2)}`;
  const list = groups.get(key);
  if (list) list.push(piece);
  else groups.set(key, [piece]);
};

const splitKey = (key: string): [number, number] => {
  const [tone = "0", alpha = "1"] = key.split(":", 2);
  return [Number(tone), Number(alpha)];
};

const slabEdges = 12;

interface Plane {
  alpha: number;
  depth: number;
  pieces: string[];
  tone: number;
  y: number;
}

const clipDepth = (m: Float32Array, x: number, y: number, z: number): number =>
  (m[2] ?? 0) * x + (m[6] ?? 0) * y + (m[10] ?? 0) * z + (m[14] ?? 0);

const planePattern = (
  m: Float32Array,
  plane: Plane,
  id: string,
  width: number,
  height: number
): undefined | { opacity: number; pattern: string } => {
  const [x0, y0] = project(m, { x: 0, y: plane.y, z: 0 }, width, height);
  const [x1, y1] = project(m, { x: 1, y: plane.y, z: 0 }, width, height);
  const [x2, y2] = project(m, { x: 0, y: plane.y, z: 1 }, width, height);
  const a = x1 - x0;
  const b = y1 - y0;
  const c = x2 - x0;
  const d = y2 - y0;
  const spacing = dotPitch * Math.min(Math.hypot(a, b), Math.hypot(c, d));
  const fade = dotSpacingFade(spacing);
  const scale = Math.sqrt(Math.abs(a * d - b * c));
  if (scale === 0 || fade <= 0.001) return undefined;
  const half = dotPitch / 2;
  const depth = dotDepthFade(plane.depth / Math.max(1, plane.pieces.length));
  const matrix = [a, b, c, d, x0, y0].map((n) => n.toFixed(3)).join(" ");
  return {
    opacity: plane.alpha * dotGain * fade * depth,
    pattern: `<pattern id="${id}"${toneClass(plane.tone)} width="${String(dotPitch)}" height="${String(dotPitch)}" patternUnits="userSpaceOnUse" patternTransform="matrix(${matrix})"><circle cx="${String(half)}" cy="${String(half)}" r="${(dotRadius / scale).toFixed(4)}" fill="currentColor" stroke="none"/></pattern>`,
  };
};

export const sceneSvg = (
  scene: Scene,
  width: number,
  height: number,
  svgAttrs = ""
): string => {
  const m = frameMatrix(width / height, scene, 0, 0);
  const at = (x: number, y: number, z: number): string => {
    const [px, py] = project(m, { x, y, z }, width, height);
    return `${fmt(px)} ${fmt(py)}`;
  };
  const { lineColors, lines, points, triColors, tris } = scene;

  const segment = (k: number): string => {
    const o = k * strides.line;
    const a = at(lines[o] ?? 0, lines[o + 1] ?? 0, lines[o + 2] ?? 0);
    const b = at(lines[o + 3] ?? 0, lines[o + 4] ?? 0, lines[o + 5] ?? 0);
    return `M${a}L${b}`;
  };

  const slabs: string[] = [];
  const slabCount = scene.slabSegments / slabEdges;
  for (let i = 0; i < slabCount; i += 1) {
    const first = i * slabEdges;
    const d: string[] = [];
    for (let k = first; k < first + slabEdges; k += 1) d.push(segment(k));
    const tone = lineColors[first * strides.lineColor] ?? 0;
    const alpha = lineColors[first * strides.lineColor + 1] ?? 1;
    slabs.push(
      `<g${toneClass(tone)} stroke-opacity="${alpha.toFixed(2)}"><path class="slab" d="${d.join("")}"/></g>`
    );
  }

  const hairlines = new Map<string, string[]>();
  for (let k = scene.slabSegments; k < lines.length / strides.line; k += 1) {
    group(
      hairlines,
      lineColors[k * strides.lineColor] ?? 0,
      lineColors[k * strides.lineColor + 1] ?? 1,
      segment(k)
    );
  }

  const faces = new Map<string, string[]>();
  const planes = new Map<string, Plane>();
  for (let k = 0; k < tris.length / strides.tri; k += 1) {
    const o = k * strides.tri;
    const toneIndex = triColors[k * strides.triColor] ?? 0;
    const alpha = triColors[k * strides.triColor + 1] ?? 1;
    const piece = `M${[0, 3, 6]
      .map((j) =>
        at(tris[o + j] ?? 0, tris[o + j + 1] ?? 0, tris[o + j + 2] ?? 0)
      )
      .join("L")}Z`;
    group(faces, toneIndex, alpha, piece);
    const y = tris[o + 1] ?? 0;
    if (tris[o + 4] !== y || tris[o + 7] !== y) continue;
    const key = `${y.toFixed(3)}:${String(toneIndex)}:${alpha.toFixed(3)}`;
    const plane = planes.get(key) ?? {
      alpha,
      depth: 0,
      pieces: [],
      tone: toneIndex,
      y,
    };
    plane.pieces.push(piece);
    for (const j of [0, 3, 6]) {
      plane.depth +=
        clipDepth(m, tris[o + j] ?? 0, y, tris[o + j + 2] ?? 0) / 3;
    }
    planes.set(key, plane);
  }
  const patterns: string[] = [];
  const dotted: string[] = [];
  for (const plane of planes.values()) {
    const id = `dots-${String(width)}x${String(height)}-${String(patterns.length)}`;
    const dotPattern = planePattern(m, plane, id, width, height);
    if (!dotPattern) continue;
    patterns.push(dotPattern.pattern);
    dotted.push(
      `<g${toneClass(plane.tone)}><path class="dots" fill="url(#${id})" fill-opacity="${dotPattern.opacity.toFixed(3)}" d="${plane.pieces.join("")}"/></g>`
    );
  }

  const dots = new Map<string, string[]>();
  for (let k = 0; k < points.length / strides.point; k += 1) {
    const o = k * strides.point;
    group(
      dots,
      points[o + 3] ?? 0,
      points[o + 4] ?? 1,
      `M${at(points[o] ?? 0, points[o + 1] ?? 0, points[o + 2] ?? 0)}h0`
    );
  }

  const paths = (
    groups: Map<string, string[]>,
    attrs: string,
    pathClass: string
  ): string[] =>
    [...groups].map(([key, pieces]) => {
      const [tone, alpha] = splitKey(key);
      const opacity = attrs.includes("fill")
        ? `fill-opacity="${alpha.toFixed(2)}"`
        : `stroke-opacity="${alpha.toFixed(2)}"`;
      return `<g${toneClass(tone)} ${opacity}${attrs}><path class="${pathClass}" d="${pieces.join("")}"/></g>`;
    });

  const texts = scene.labels.map((label) => {
    const [x, y] = project(m, label.at, width, height);
    const anchor = label.center ? "middle" : "start";
    const tone = toneNames.indexOf(label.tone);
    return `<text${toneClass(tone)} x="${fmt(x)}" y="${fmt(y)}" text-anchor="${anchor}" dominant-baseline="central" opacity="${label.alpha.toFixed(2)}">${escapeText(label.text)}</text>`;
  });

  return [
    `<svg ${svgAttrs ? `${svgAttrs} ` : ""}xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(width)} ${String(height)}" width="${String(width)}" height="${String(height)}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">`,
    ...(patterns.length > 0 ? [`<defs>${patterns.join("")}</defs>`] : []),
    ...paths(faces, ' fill="currentColor" stroke="none"', "face"),
    ...(dotted.length > 0 ? [`<g stroke="none">${dotted.join("")}</g>`] : []),
    `<g stroke-width="1.25">${slabs.join("")}</g>`,
    `<g stroke-width="1">${paths(hairlines, "", "hair").join("")}</g>`,
    `<g stroke-width="2">${paths(dots, "", "dot").join("")}</g>`,
    `<g font-family="Geist Mono, ui-monospace, monospace" font-size="11" fill="currentColor" stroke="none">${texts.join("")}</g>`,
    "</svg>",
  ].join("");
};

export const posterSvg = (
  width: number,
  height: number,
  counts: SceneCounts,
  svgAttrs = ""
): string =>
  sceneSvg(buildScene("outro", 1, 1, counts), width, height, svgAttrs);
