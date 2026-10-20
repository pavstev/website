export interface SortState {
  column: string;
  direction: SortDirection;
}

export type SortValue = null | number | string | undefined;

type SortDirection = "ascending" | "descending";

const collator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

const empty: ReadonlySet<SortValue> = new Set(["", null, undefined]);

const isEmpty = (value: SortValue): boolean => empty.has(value);

export const nextSort = (
  current: null | SortState,
  column: string
): null | SortState => {
  if (current?.column !== column) return { column, direction: "ascending" };
  return current.direction === "ascending"
    ? { column, direction: "descending" }
    : null;
};

export const ariaSort = (
  current: null | SortState,
  column: string
): "ascending" | "descending" | "none" =>
  current?.column === column ? current.direction : "none";

const compare = (a: SortValue, b: SortValue): number =>
  typeof a === "number" && typeof b === "number"
    ? a - b
    : collator.compare(String(a), String(b));

export const sortRows = <T>(
  rows: readonly T[],
  sort: null | SortState,
  value: (row: T, column: string) => SortValue
): T[] => {
  const indexed = rows.map((row, index) => ({ index, row }));
  if (sort === null) return indexed.map((item) => item.row);
  const sign = sort.direction === "ascending" ? 1 : -1;
  indexed.sort((x, y) => {
    const a = value(x.row, sort.column);
    const b = value(y.row, sort.column);
    if (isEmpty(a) || isEmpty(b)) {
      if (isEmpty(a) && isEmpty(b)) return x.index - y.index;
      return isEmpty(a) ? 1 : -1;
    }
    const order = compare(a, b);
    return order === 0 ? x.index - y.index : order * sign;
  });
  return indexed.map((item) => item.row);
};
