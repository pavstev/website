export const seedOf = (text: string): number => {
  let seed = 2_166_136_261;
  for (const char of text) {
    seed = Math.imul(seed ^ (char.codePointAt(0) ?? 0), 16_777_619);
  }
  return seed >>> 0;
};
