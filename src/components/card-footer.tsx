import type { ReactElement } from "react";

import { personalData } from "@/lib/personal";

export const CardFooter = (): ReactElement => {
  const year = new Date().getFullYear();
  return (
    <p className="card-footer fade-up tabular mt-(--card-gap-footer) type-chip text-foreground-soft delay-4">
      © {year} <span className="whitespace-nowrap">{personalData.name}</span>
    </p>
  );
};
