export const pageSize = 10;

export interface PageSlice<T> {
  count: number;
  items: T[];
  page: number;
}

export const pageCount = (total: number, size: number = pageSize): number =>
  Math.max(1, Math.ceil(total / size));

export const pageHref = (base: string, page: number): string =>
  page <= 1 ? base : `${base}/page/${String(page)}`;

export const laterPages = (total: number, size: number = pageSize): number[] =>
  Array.from({ length: pageCount(total, size) - 1 }, (_, index) => index + 2);

export type PageWindowItem = "gap-l" | "gap-r" | number;

const span = (from: number, to: number): number[] =>
  Array.from(
    { length: Math.max(0, to - from + 1) },
    (_, index) => from + index
  );

export const pageWindow = (
  page: number,
  count: number,
  siblings = 1,
  boundaries = 1
): PageWindowItem[] => {
  if (count <= 2 * boundaries + 2 * siblings + 3) return span(1, count);
  const tail = span(count - boundaries + 1, count);
  if (page < boundaries + siblings + 2)
    return [...span(1, 2 * siblings + boundaries + 2), "gap-r", ...tail];
  if (page > count - boundaries - siblings - 1)
    return [
      ...span(1, boundaries),
      "gap-l",
      ...span(count - 2 * siblings - boundaries - 1, count),
    ];
  return [
    ...span(1, boundaries),
    "gap-l",
    ...span(page - siblings, page + siblings),
    "gap-r",
    ...tail,
  ];
};

export const parsePage = (text: string): number | undefined =>
  /^[1-9]\d*$/u.test(text) ? Number(text) : undefined;

export const pageSlice = <T>(
  items: readonly T[],
  page: number,
  size: number = pageSize
): PageSlice<T> | undefined => {
  const count = pageCount(items.length, size);
  if (!Number.isSafeInteger(page) || page < 1 || page > count) return undefined;
  return {
    count,
    items: items.slice((page - 1) * size, page * size),
    page,
  };
};
