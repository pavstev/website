export const escapeMarkdown = (value: string): string =>
  value.replaceAll(/[\\*<>[\]_`|]/g, String.raw`\$&`);

export const compareText = (a: string, b: string): number => {
  if (a < b) return -1;
  return a > b ? 1 : 0;
};
