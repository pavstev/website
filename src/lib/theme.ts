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
  austria: "#6F8DE8",
  coast: "#C3CEFF",
  dayLand: "#36446E",
  dayOcean: "#0F1631",
  hub: "#FFD966",
  marker: skyTokens.gold,
  nightLand: "#0E1324",
  nightOcean: "#04060E",
  rim: skyTokens.blue,
  sunlight: "#D6E0FF",
  twilight: "#7A3B5C",
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
