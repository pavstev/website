export const designTokens = {
  background: "#07080F",
} as const;

const skyTokens = {
  blue: "#5E8BFF",
  gold: "#FFC46B",
  rose: "#FF6FB5",
  teal: "#4FE0C8",
  violet: "#A97CFF",
} as const;

type SkyTokenName = keyof typeof skyTokens;

const uiTokens = {
  accent: "#93B0FF",
  cool200: "#E2E5EE",
} as const;

export const inkPalette = {
  dark: designTokens.background,
  foreground: "#E8EAF2",
  muted: "#8B91A7",
  soft: "#C3C7D6",
} as const;

export const profilePalette = {
  glyph: inkPalette.soft,
  ring: inkPalette.foreground,
  sky: skyTokens,
} as const;

const productGreen = "#32d74b";

export const productPalette = {
  "safety-real-time": {
    accent: productGreen,
    disc: "#070908",
    mark: productGreen,
    tint: productGreen,
  },
} as const;

export const ditherTones = [
  designTokens.background,
  "#3B4A7A",
  uiTokens.accent,
  uiTokens.cool200,
] as const;

export const ditherOutline = "#C9D6FF";

export const storyPalette = {
  accent: "#7AA2FF",
  denied: "#F5897F",
  face: 0.04,
  grid: 0.08,
  hair: 0.1,
  hairStrong: 0.22,
  ink: "#E8EAF2",
  line: "#C3C7D6",
  mark: "#B48CFF",
  markAlt: "#5EE2B5",
  muted: "#8B91A7",
  paper: "#07080F",
  white: "#FFFFFF",
} as const;

export const hexBytes = (hex: string): [number, number, number] => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

export const skyRgb = (name: SkyTokenName): [number, number, number] => {
  const [r, g, b] = hexBytes(skyTokens[name]);
  return [r / 255, g / 255, b / 255];
};

export const resumePdfPalette = {
  accent: "#3B82F6",
  rule: "#D9D9E0",
  subtle: "#60646C",
  text: "#1C2024",
} as const;
