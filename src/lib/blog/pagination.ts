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
