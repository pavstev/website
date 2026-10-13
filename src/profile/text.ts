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

export const round = (value: number, digits = 1): string =>
  String(Number(value.toFixed(digits)));

export const compareText = (a: string, b: string): number => {
  if (a < b) return -1;
  return a > b ? 1 : 0;
};
