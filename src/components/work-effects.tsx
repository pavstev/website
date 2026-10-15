import { useEffect } from "react";

import { initAnchoredPopovers } from "@/lib/anchored-popovers";
import { initTagFit } from "@/lib/repo-tags-fit";

export const WorkEffects = (): null => {
  useEffect(() => {
    const disposers = [initAnchoredPopovers(document), initTagFit(document)];
    return () => {
      for (const dispose of disposers) dispose();
    };
  }, []);
  return null;
};
