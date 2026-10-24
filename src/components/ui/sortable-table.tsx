import { motion } from "motion/react";
import { type ReactElement, useMemo, useState } from "react";

import {
  ariaSort,
  nextSort,
  sortRows,
  type SortState,
  type SortValue,
} from "@/lib/blog/sort-rows";
import { useStill } from "@/lib/use-still";

export interface SortableColumn<T> {
  header: string;
  id: string;
  numeric?: boolean;
  text: (row: T) => string;
  value: (row: T) => SortValue;
}

interface SortableTableProps<T> {
  caption: string;
  columns: Array<SortableColumn<T>>;
  describe: (sort: null | SortState, header: string, count: number) => string;
  getRowId: (row: T) => string;
  rows: T[];
}

const CELL = {
  damping: 34,
  mass: 0.45,
  stiffness: 520,
  type: "spring",
} as const;
const SMALL = {
  damping: 46,
  mass: 0.5,
  stiffness: 700,
  type: "spring",
} as const;
const STILL = { duration: 0 } as const;
const STEP = 0.018;
const stepCap = 8;

export const SortableTable = <T,>({
  caption,
  columns,
  describe,
  getRowId,
  rows,
}: SortableTableProps<T>): ReactElement => {
  const still = useStill();
  const [sort, setSort] = useState<null | SortState>(null);
  const [touched, setTouched] = useState(false);

  const ordered = useMemo(
    () =>
      sortRows(rows, sort, (row, column) =>
        columns.find((item) => item.id === column)?.value(row)
      ),
    [columns, rows, sort]
  );

  const header = columns.find((item) => item.id === sort?.column)?.header ?? "";

  return (
    <>
      <table className="sortable-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => {
              const state = ariaSort(sort, column.id);
              return (
                <th
                  aria-sort={state}
                  className="sortable-head"
                  data-numeric={column.numeric === true ? "" : undefined}
                  key={column.id}
                  scope="col"
                >
                  <button
                    className="sortable-button focus-ring"
                    onClick={() => {
                      setTouched(true);
                      setSort(nextSort(sort, column.id));
                    }}
                    type="button"
                  >
                    <span>{column.header}</span>
                    <motion.svg
                      animate={{
                        opacity: state === "none" ? 0 : 1,
                        rotate: state === "descending" ? 180 : 0,
                        scale: state === "none" ? 0.72 : 1,
                      }}
                      aria-hidden="true"
                      className="sortable-arrow"
                      fill="none"
                      height="10"
                      initial={false}
                      transition={still ? STILL : SMALL}
                      viewBox="0 0 10 10"
                      width="10"
                    >
                      <path
                        d="M5 8.6V1.6M5 1.6 2.2 4.4M5 1.6l2.8 2.8"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.4"
                      />
                    </motion.svg>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {ordered.map((row, index) => (
            <motion.tr
              key={getRowId(row)}
              layout="position"
              transition={
                still
                  ? STILL
                  : { ...CELL, delay: Math.min(index, stepCap) * STEP }
              }
            >
              {columns.map((column, position) =>
                position === 0 ? (
                  <th key={column.id} scope="row">
                    {column.text(row)}
                  </th>
                ) : (
                  <td
                    data-numeric={column.numeric === true ? "" : undefined}
                    key={column.id}
                  >
                    {column.text(row)}
                  </td>
                )
              )}
            </motion.tr>
          ))}
        </tbody>
      </table>
      <div aria-live="polite" className="sr-only" role="status">
        {touched ? describe(sort, header, rows.length) : ""}
      </div>
    </>
  );
};
