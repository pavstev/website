import { lutCols, lutRows, mixSkyTable, type SkyTable } from "./sky-light.ts";

export interface GridView {
  height: number;
  width: number;
}

export interface TableGrid {
  at: (chapter: number) => SkyTable | undefined;
  filled: () => number;
  next: (chapter: number) => number | undefined;
  put: (index: number, table: SkyTable) => void;
  reset: () => void;
  skip: (index: number) => void;
}

export const gridChapters = 8;
export const gridPerChapter = 12;
export const gridCount = gridChapters * gridPerChapter + 1;

const heightTolerance = 0.15;

export const gridChapter = (index: number): number => index / gridPerChapter;

export const gridKeeps = (built: GridView, now: GridView): boolean =>
  built.width === now.width &&
  Math.abs(now.height - built.height) <= built.height * heightTolerance;

const scratchTable = (): SkyTable => ({
  lit: [0, 0, 0],
  low: [0, 0, 0],
  mid: [0, 0, 0],
  pixels: new Uint8Array(lutCols * lutRows * 4),
  shade: [0, 0, 0],
  sunColor: [0, 0, 0],
  top: [0, 0, 0],
});

export const createTableGrid = (): TableGrid => {
  const slots: Array<null | SkyTable | undefined> = Array.from({
    length: gridCount,
  });
  const scratch = scratchTable();
  const last = gridCount - 1;

  const built = (index: number): SkyTable | undefined =>
    slots[index] ?? undefined;

  return {
    at: (chapter) => {
      const place =
        Math.min(Math.max(chapter, 0), gridChapters) * gridPerChapter;
      const low = Math.min(Math.floor(place), last - 1);
      const from = built(low);
      const to = built(low + 1);
      return from && to
        ? mixSkyTable(from, to, place - low, scratch)
        : (from ?? to);
    },
    filled: () => slots.filter(Boolean).length,
    next: (chapter) => {
      const center = Math.round(
        Math.min(Math.max(chapter, 0), gridChapters) * gridPerChapter
      );
      return Array.from({ length: gridCount }, (_, reach) => [
        center - reach,
        center + reach,
      ])
        .flat()
        .find(
          (index) => index >= 0 && index <= last && slots[index] === undefined
        );
    },
    put: (index, table) => {
      if (index >= 0 && index <= last) slots[index] = table;
    },
    reset: () => {
      slots.fill(undefined);
    },
    skip: (index) => {
      if (index >= 0 && index <= last) slots[index] = null;
    },
  };
};
