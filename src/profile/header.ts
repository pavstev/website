import type { ProfileInput } from "./types.ts";

import { profilePalette } from "../lib/theme.ts";
import { escapeXml } from "./text.ts";

export const headerWidth = 2400;
export const headerHeight = 360;
const extraRange =
  "U+0106-0107,U+010C-010D,U+0110-0111,U+0160-0161,U+017D-017E";
const fontFamily = `"Inter Variable",Inter,"Helvetica Neue",Arial,sans-serif`;
const nameFamily = `Geist,${fontFamily}`;

const fontFace = (
  family: string,
  weights: string,
  bytes: Uint8Array,
  range?: string
): string =>
  `@font-face{font-family:"${family}";font-weight:${weights};src:url(data:font/woff2;base64,${Buffer.from(bytes).toString("base64")}) format("woff2");${range ? `unicode-range:${range};` : ""}}`;

export const renderHeader = (input: ProfileInput): string => {
  const { fonts, personal, sky } = input;
  const { background, glyph, ring } = profilePalette;
  const label = `${personal.name}, ${personal.title}`;
  const width = String(headerWidth);
  const height = String(headerHeight);
  const middle = String(headerWidth / 2);
  return `${[
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title">`,
    `<title id="title">${escapeXml(label)}</title>`,
    `<defs>`,
    `<style>${fontFace("Inter Variable", "100 900", fonts.latin)}${fontFace("Inter Variable", "100 900", fonts.extra, extraRange)}${fontFace("Geist", "600", fonts.nameLatin)}${fontFace("Geist", "600", fonts.nameExtra, extraRange)}.n{font:600 120px ${nameFamily};letter-spacing:2.4px;fill:${ring}}.s{font:400 44px ${fontFamily};fill:${glyph}}</style>`,
    `</defs>`,
    `<rect width="${width}" height="${height}" fill="${background}"/>`,
    `<image width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" href="data:image/webp;base64,${Buffer.from(sky).toString("base64")}"/>`,
    `<text class="n" x="${middle}" y="176" text-anchor="middle">${escapeXml(personal.name)}</text>`,
    `<text class="s" x="${middle}" y="256" text-anchor="middle">${escapeXml(personal.title)}</text>`,
    `</svg>`,
  ].join("")}\n`;
};
