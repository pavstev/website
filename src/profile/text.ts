const xmlEntities: Readonly<Record<string, string>> = {
  '"': "&quot;",
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

export const escapeXml = (value: string): string =>
  value.replaceAll(/["&<>]/g, (char) => xmlEntities[char] ?? char);

export const escapeMarkdown = (value: string): string =>
  value.replaceAll(/[\\*<>[\]_`]/g, String.raw`\$&`);

export const seedOf = (text: string): number => {
  let seed = 2_166_136_261;
  for (const char of text) {
    seed = Math.imul(seed ^ (char.codePointAt(0) ?? 0), 16_777_619);
  }
  return seed >>> 0;
};

export const createRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d_2b_79_f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
};

export const round = (value: number, digits = 1): string =>
  String(Number(value.toFixed(digits)));

export const compareText = (a: string, b: string): number => {
  if (a < b) return -1;
  return a > b ? 1 : 0;
};
