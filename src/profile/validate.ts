import type { ProfileFile } from "./types.ts";

export interface ValidateOptions {
  generated: string;
}

const maxHeaderBytes = 120_000;

const requiredPaths = ["README.md", "CONTRIBUTING.md", "assets/header.svg"];
const svgNamespace = "http://www.w3.org/2000/svg";

const attributes = (tag: string): Map<string, string> =>
  new Map(
    tag
      .matchAll(/\s(alt|href|src)="([^"]*)"/g)
      .map(([, name = "", value = ""]) => [name, value] as const)
  );

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

const checkImages = (readme: string, paths: ReadonlySet<string>): string[] => {
  const errors: string[] = [];
  for (const [tag] of readme.matchAll(/<img\b[^>]*>/g)) {
    const found = attributes(tag);
    const src = found.get("src") ?? "";
    if (!src) errors.push(`README.md: image without src: ${tag}`);
    else if (!/^https?:/.test(src) && !paths.has(src)) {
      errors.push(`README.md: image "${src}" is missing from the output`);
    }
    if ((found.get("alt") ?? "").trim() === "") {
      errors.push(`README.md: image "${src}" has no alt text`);
    }
  }
  return errors;
};

const checkReadme = (
  readme: string,
  paths: ReadonlySet<string>,
  options: ValidateOptions
): string[] => {
  const errors = checkImages(readme, paths);
  if (!readme.startsWith(`<!-- ${options.generated} -->\n`)) {
    errors.push("README.md: first line is not the generated notice");
  }
  const links = [
    ...readme
      .matchAll(/<a\b[^>]*>/g)
      .map(([tag]) => attributes(tag).get("href") ?? ""),
    ...markdownLinks(readme),
  ];
  for (const url of links) errors.push(...checkUrl(url, "README.md link"));
  if (/<p\b[^>]*>\s*<\/p>/.test(readme)) {
    errors.push("README.md: empty paragraph");
  }
  if (!/^## .+\n\n- .+/m.test(readme)) {
    errors.push("README.md: the projects section is empty");
  }
  return errors;
};

const checkSvg = (file: ProfileFile): string[] => {
  const errors: string[] = [];
  const { contents, path } = file;
  if (!contents.startsWith("<svg ")) errors.push(`${path}: not an SVG`);
  if (!contents.includes(`xmlns="${svgNamespace}"`)) {
    errors.push(`${path}: missing xmlns`);
  }
  if (/<script\b/i.test(contents)) errors.push(`${path}: contains a script`);
  if (/(?:href=|url\()["']?https?:/i.test(contents)) {
    errors.push(`${path}: loads something from another host`);
  }
  const size = Buffer.byteLength(contents);
  if (path === "assets/header.svg" && size > maxHeaderBytes) {
    errors.push(
      `${path}: ${String(size)} bytes is over ${String(maxHeaderBytes)}`
    );
  }
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
    if (file.path.endsWith(".svg")) errors.push(...checkSvg(file));
  }
  const readme = files.find((file) => file.path === "README.md");
  if (readme) errors.push(...checkReadme(readme.contents, paths, options));
  return errors;
};
