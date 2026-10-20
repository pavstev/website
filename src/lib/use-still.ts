import { useSyncExternalStore } from "react";

import { stillQuery } from "@/lib/motion-pause";

const subscribe = (callback: () => void): (() => void) => {
  const query = stillQuery();
  query.addEventListener("change", callback);
  return () => {
    query.removeEventListener("change", callback);
  };
};

const read = (): boolean => stillQuery().matches;

export const useStill = (): boolean =>
  useSyncExternalStore(subscribe, read, () => false);
