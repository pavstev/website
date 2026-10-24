import { type PlaceStore } from "./sky-place.ts";

export const memoryStore = (
  entries: Record<string, string> = {}
): PlaceStore => {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (key) => map.get(key) ?? null,
    removeItem: (key) => {
      map.delete(key);
    },
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
};

const blocked = (): never => {
  throw new Error("blocked");
};

export const throwingStore: PlaceStore = {
  getItem: blocked,
  removeItem: blocked,
  setItem: blocked,
};
