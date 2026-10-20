const slugCharacters = /^[a-z\d-]+$/;

const postPath = /^\/blog\/([^/]+)$/;

const maxSlugLength = 80;

export const isSlug = (value: string): boolean =>
  value.length <= maxSlugLength &&
  slugCharacters.test(value) &&
  !value.startsWith("-") &&
  !value.endsWith("-") &&
  !value.includes("--");

export const postSlug = (pathname: string): string | undefined => {
  const slug = postPath.exec(pathname)?.[1];
  return slug !== undefined && isSlug(slug) ? slug : undefined;
};

export const isBlogPage = (pathname: string): boolean =>
  pathname === "/blog" ||
  (pathname.startsWith("/blog/") &&
    !(pathname.split("/").at(-1) ?? "").includes("."));

export const pagePaths: readonly string[] = ["/about", "/work"];

export const isSitePage = (pathname: string): boolean =>
  isBlogPage(pathname) || pagePaths.includes(pathname);
