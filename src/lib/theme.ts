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

export const globePalette = {
  austria: "#6F9BFF",
  border: "#7B88DA",
  coast: "#C3CEFF",
  graticule: "#FFFFFF",
  land: "#3F4FA6",
  marker: skyTokens.gold,
  ocean: "#121C45",
  rim: skyTokens.blue,
  sheen: "#DDE6FF",
} as const;

export const profilePalette = {
  background: designTokens.background,
  glyph: "#C3C7D6",
  muted: "#8B91A7",
  ring: "#E8EAF2",
  sky: skyTokens,
} as const;

export const skyRgb = (name: SkyTokenName): [number, number, number] => {
  const value = Number.parseInt(skyTokens[name].slice(1), 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
};
