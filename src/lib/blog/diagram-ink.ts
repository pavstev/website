export const ink = {
  accent: "var(--primary)",
  detail: "var(--muted-foreground)",
  fill: "var(--background)",
  label: "var(--foreground)",
  line: "var(--muted-foreground)",
  plane: "var(--border)",
  rim: "var(--border-strong)",
  soft: "var(--foreground-soft)",
  warm: "var(--sky-gold)",
} as const;

export const size = {
  detail: 12.5,
  label: 14,
  mono: 12.5,
  tick: 12,
} as const;

const seriesColors = [
  "var(--primary)",
  "var(--sky-gold)",
  "var(--accent-green)",
  "var(--sky-rose)",
] as const;

export const chartTone = (tone: "before" | number): string =>
  tone === "before"
    ? ink.detail
    : (seriesColors[tone % seriesColors.length] ?? seriesColors[0]);
