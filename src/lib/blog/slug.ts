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
