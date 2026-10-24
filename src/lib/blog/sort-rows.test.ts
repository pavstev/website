import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ariaSort, nextSort, sortRows, type SortState } from "./sort-rows.ts";

interface Row {
  id: string;
  size: null | number;
}

const rows: Row[] = [
  { id: "b", size: 10 },
  { id: "a", size: 2 },
  { id: "c", size: null },
  { id: "d", size: 10 },
];

const value = (row: Row, column: string): null | number | string =>
  column === "size" ? row.size : row.id;

const ids = (list: Row[]): string => list.map((row) => row.id).join("");

describe("nextSort", () => {
  it("cycles ascending, descending, original", () => {
    const first = nextSort(null, "size");
    assert.deepEqual(first, { column: "size", direction: "ascending" });
    const second = nextSort(first, "size");
    assert.deepEqual(second, { column: "size", direction: "descending" });
    assert.equal(nextSort(second, "size"), null);
  });

  it("starts ascending on another column", () => {
    const other: SortState = { column: "id", direction: "descending" };
    assert.deepEqual(nextSort(other, "size"), {
      column: "size",
      direction: "ascending",
    });
  });
});

describe("ariaSort", () => {
  it("names the active column and none for the rest", () => {
    const state: SortState = { column: "size", direction: "descending" };
    assert.equal(ariaSort(state, "size"), "descending");
    assert.equal(ariaSort(state, "id"), "none");
    assert.equal(ariaSort(null, "size"), "none");
  });
});

describe("sortRows", () => {
  it("keeps the original order without a sort", () => {
    assert.equal(ids(sortRows(rows, null, value)), "bacd");
  });

  it("sorts numbers ascending with equal values in source order", () => {
    const sorted = sortRows(
      rows,
      { column: "size", direction: "ascending" },
      value
    );
    assert.equal(ids(sorted), "abdc");
  });

  it("puts empty values last in both directions", () => {
    const sorted = sortRows(
      rows,
      { column: "size", direction: "descending" },
      value
    );
    assert.equal(ids(sorted), "bdac");
  });

  it("sorts text with natural number order", () => {
    const named = [{ id: "item 10" }, { id: "item 2" }, { id: "Item 1" }];
    const sorted = sortRows(
      named,
      { column: "id", direction: "ascending" },
      (row) => row.id
    );
    assert.deepEqual(
      sorted.map((row) => row.id),
      ["Item 1", "item 2", "item 10"]
    );
  });

  it("does not change the input", () => {
    const copy = [...rows];
    sortRows(rows, { column: "id", direction: "descending" }, value);
    assert.deepEqual(rows, copy);
  });
});
