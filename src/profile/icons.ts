import type {
  IconData,
  ProfileFile,
  ProfileInput,
  ProfilePerson,
} from "./types.ts";

import { profilePalette } from "../lib/theme.ts";
import { round } from "./text.ts";

export interface Badge {
  accent: Accent;
  alt: string;
  file: string;
  glyph: number;
  href: string;
  icon: string;
}

type Accent = keyof typeof profilePalette.sky;

const badgeSize = 48;
const flagIcon = "circle-flags:at";

const iconOf = (input: ProfileInput, name: string): IconData => {
  const icon = input.icons[name];
  if (!icon) throw new Error(`Unknown icon "${name}"`);
  return icon;
};

export const resumeUrl = (person: ProfilePerson): string =>
  new URL("/resume.pdf", person.website).href;

export const buildBadges = (input: ProfileInput): Badge[] => [
  {
    accent: "blue",
    alt: input.strings.profile.website,
    file: "assets/icon-website.svg",
    glyph: 20,
    href: input.personal.website,
    icon: "lucide:globe",
  },
  {
    accent: "teal",
    alt: input.strings.card.linkedin,
    file: "assets/icon-linkedin.svg",
    glyph: 18,
    href: input.personal.linkedin,
    icon: "simple-icons:linkedin",
  },
  {
    accent: "violet",
    alt: input.strings.profile.resume,
    file: "assets/icon-resume.svg",
    glyph: 20,
    href: resumeUrl(input.personal),
    icon: "lucide:download",
  },
];

const stop = (offset: string, color: string, opacity: string): string =>
  `<stop offset="${offset}" stop-color="${color}" stop-opacity="${opacity}"/>`;

const renderBadge = (input: ProfileInput, badge: Badge): string => {
  const icon = iconOf(input, badge.icon);
  const accent = profilePalette.sky[badge.accent];
  const { background, glyph, ring } = profilePalette;
  const offset = (badgeSize - badge.glyph) / 2;
  const scale = badge.glyph / icon.width;
  const disc = `cx="24" cy="24" r="23.25"`;
  return `${[
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(badgeSize)} ${String(badgeSize)}">`,
    `<defs>`,
    `<radialGradient id="t" cx=".32" cy=".28" r=".75">${stop("0", accent, ".3")}${stop(".55", accent, ".08")}${stop("1", accent, "0")}</radialGradient>`,
    `<linearGradient id="r" x1=".12" y1=".12" x2=".88" y2=".88">${stop("0", ring, ".95")}${stop(".3", ring, ".4")}${stop(".65", ring, ".14")}${stop("1", ring, ".4")}</linearGradient>`,
    `</defs>`,
    `<circle ${disc} fill="${background}"/>`,
    `<circle ${disc} fill="url(#t)"/>`,
    `<circle ${disc} fill="none" stroke="url(#r)" stroke-width="1.5"/>`,
    `<g transform="translate(${round(offset)} ${round(offset)}) scale(${round(scale, 4)})" color="${glyph}">${icon.body}</g>`,
    `</svg>`,
  ].join("")}\n`;
};

const renderFlag = (input: ProfileInput): string => {
  const icon = iconOf(input, flagIcon);
  const size = String(icon.width);
  const half = String(icon.width / 2);
  return `${[
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${String(icon.height)}">`,
    icon.body,
    `<circle cx="${half}" cy="${half}" r="${String(icon.width / 2 - 16)}" fill="none" stroke="${profilePalette.muted}" stroke-width="32" stroke-opacity=".75"/>`,
    `</svg>`,
  ].join("")}\n`;
};

export const flagFile = (input: ProfileInput): ProfileFile => ({
  contents: renderFlag(input),
  path: "assets/flag-at.svg",
});

export const badgeFile = (input: ProfileInput, badge: Badge): ProfileFile => ({
  contents: renderBadge(input, badge),
  path: badge.file,
});
