import type { ProfileFile } from "./types.ts";

export interface ValidateOptions {
  generated: string;
}

const requiredPaths = ["README.md", "CONTRIBUTING.md"];

const markdownLinks = (text: string): string[] =>
  text
    .matchAll(/\]\(([^)\s]+)\)/g)
    .map(([, url = ""]) => url)
    .toArray();

const checkUrl = (url: string, label: string): string[] => {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "mailto:"
      ? []
      : [`${label}: "${url}" is not https`];
  } catch {
    return [`${label}: "${url}" is not an absolute URL`];
  }
};

const checkReadme = (readme: string, options: ValidateOptions): string[] => {
  const errors: string[] = [];
  if (!readme.startsWith(`<!-- ${options.generated} -->\n`)) {
    errors.push("README.md: first line is not the generated notice");
  }
  const links = markdownLinks(readme);
  for (const url of links) errors.push(...checkUrl(url, "README.md link"));
  if (!/^## .+\n\n\| .+\n\| :--/m.test(readme)) {
    errors.push("README.md: the projects section is empty");
  }
  if (/<img\b/i.test(readme)) errors.push("README.md: contains an image");
  return errors;
};

export const validateProfile = (
  files: readonly ProfileFile[],
  options: ValidateOptions
): string[] => {
  const paths = new Set(files.map((file) => file.path));
  const errors: string[] = [];
  if (paths.size !== files.length) errors.push("Duplicate output paths");
  for (const required of requiredPaths) {
    if (!paths.has(required)) errors.push(`${required} is missing`);
  }
  for (const file of files) {
    if (file.contents.includes("\r")) errors.push(`${file.path}: has CR`);
    if (!file.contents.endsWith("\n") || file.contents.endsWith("\n\n")) {
      errors.push(`${file.path}: must end with exactly one newline`);
    }
  }
  const readme = files.find((file) => file.path === "README.md");
  if (readme) errors.push(...checkReadme(readme.contents, options));
  return errors;
};
