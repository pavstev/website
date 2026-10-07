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

export const skyRgb = (name: SkyTokenName): [number, number, number] => {
  const value = Number.parseInt(skyTokens[name].slice(1), 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
};

const languageColors = new Map<string, string>([
  ["C#", "#178600"],
  ["C++", "#F34B7D"],
  ["CSS", "#663399"],
  ["Dart", "#00B4AB"],
  ["Go", "#00ADD8"],
  ["HTML", "#E34C26"],
  ["Java", "#B07219"],
  ["JavaScript", "#F1E05A"],
  ["Kotlin", "#A97BFF"],
  ["PHP", "#4F5D95"],
  ["Python", "#3572A5"],
  ["Rust", "#DEA584"],
  ["Shell", "#89E051"],
  ["Swift", "#F05138"],
  ["TypeScript", "#3178C6"],
  ["Vue", "#41B883"],
  ["Zig", "#EC915C"],
]);

export const languageColor = (language?: string): string | undefined =>
  language ? languageColors.get(language) : undefined;
