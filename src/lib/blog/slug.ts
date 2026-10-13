const slugCharacters = /^[a-z\d-]+$/;

const maxSlugLength = 80;

export const isSlug = (value: string): boolean =>
  value.length <= maxSlugLength &&
  slugCharacters.test(value) &&
  !value.startsWith("-") &&
  !value.endsWith("-") &&
  !value.includes("--");
