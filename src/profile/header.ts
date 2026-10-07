import type { ProfileInput } from "./types.ts";

import { profilePalette } from "../lib/theme.ts";
import { createRandom, escapeXml, round, seedOf } from "./text.ts";

const width = 2400;
const height = 480;
const starCount = 90;
const extraRange =
  "U+0106-0107,U+010C-010D,U+0110-0111,U+0160-0161,U+017D-017E";
const fontFamily = `"Inter Variable",Inter,"Helvetica Neue",Arial,sans-serif`;

const fontFace = (bytes: Uint8Array, range?: string): string =>
  `@font-face{font-family:"Inter Variable";font-weight:100 900;src:url(data:font/woff2;base64,${Buffer.from(bytes).toString("base64")}) format("woff2");${range ? `unicode-range:${range};` : ""}}`;

const glow = (id: string, color: string, inner: string): string =>
  `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${inner}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;

const clouds = (random: () => number): string => {
  const { sky } = profilePalette;
  const fills = ["url(#cv)", "url(#cb)", "url(#cd)"];
  const items = Array.from({ length: 9 }, (_, index) => {
    const side = index % 2 === 0 ? 0.18 : 0.82;
    const x = width * (side + (random() - 0.5) * 0.3);
    const y = height * (0.1 + random() * 0.55);
    const rx = 260 + random() * 340;
    const ry = 70 + random() * 90;
    return `<ellipse cx="${round(x)}" cy="${round(y)}" rx="${round(rx)}" ry="${round(ry)}" fill="${fills[index % fills.length] ?? sky.violet}"/>`;
  });
  return items.join("");
};

const stars = (random: () => number): string => {
  const { ring, sky } = profilePalette;
  const tints = [ring, ring, ring, ring, sky.blue, sky.gold];
  const items = Array.from({ length: starCount }, () => {
    const x = random() * width;
    const y = random() * height;
    const radius = 0.7 + random() ** 3 * 1.7;
    const opacity = 0.25 + random() * 0.6;
    const tint = tints[Math.floor(random() * tints.length)] ?? ring;
    return `<circle cx="${round(x)}" cy="${round(y)}" r="${round(radius, 2)}" fill="${tint}" fill-opacity="${round(opacity, 2)}"/>`;
  });
  return items.join("");
};

export const renderHeader = (input: ProfileInput): string => {
  const { fonts, personal } = input;
  const { background, glyph, ring, sky } = profilePalette;
  const random = createRandom(seedOf(personal.name));
  const label = `${personal.name}, ${personal.title}`;
  const rim = `<linearGradient id="rim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${sky.violet}" stop-opacity="0"/><stop offset=".35" stop-color="${sky.rose}" stop-opacity=".8"/><stop offset=".65" stop-color="${sky.gold}" stop-opacity=".6"/><stop offset="1" stop-color="${sky.blue}" stop-opacity="0"/></linearGradient>`;
  return `${[
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(width)} ${String(height)}" role="img" aria-labelledby="title">`,
    `<title id="title">${escapeXml(label)}</title>`,
    `<defs>`,
    `<style>${fontFace(fonts.latin)}${fontFace(fonts.extra, extraRange)}.n{font:700 132px ${fontFamily};letter-spacing:-3px;fill:${ring}}.s{font:400 46px ${fontFamily};fill:${glyph}}</style>`,
    glow("gv", sky.violet, ".38"),
    glow("gb", sky.blue, ".3"),
    glow("gr", sky.rose, ".4"),
    glow("cv", sky.violet, ".26"),
    glow("cb", sky.blue, ".2"),
    glow("cd", background, ".5"),
    glow("shade", background, ".62"),
    rim,
    `</defs>`,
    `<rect width="${String(width)}" height="${String(height)}" fill="${background}"/>`,
    `<ellipse cx="360" cy="60" rx="900" ry="420" fill="url(#gv)"/>`,
    `<ellipse cx="2040" cy="90" rx="820" ry="400" fill="url(#gb)"/>`,
    `<ellipse cx="1200" cy="560" rx="760" ry="260" fill="url(#gr)"/>`,
    clouds(random),
    `<g>${stars(random)}</g>`,
    `<circle cx="1200" cy="1014" r="600" fill="${background}" fill-opacity=".85" stroke="url(#rim)" stroke-width="5"/>`,
    `<ellipse cx="1200" cy="250" rx="1000" ry="220" fill="url(#shade)"/>`,
    `<text class="n" x="1200" y="236" text-anchor="middle">${escapeXml(personal.name)}</text>`,
    `<text class="s" x="1200" y="332" text-anchor="middle">${escapeXml(personal.title)}</text>`,
    `</svg>`,
  ].join("")}\n`;
};
