import type { ReactElement } from "react";

import { personalData } from "@/lib/personal";

export const CardFooter = (): ReactElement => {
  const year = new Date().getFullYear();
  return (
    <p className="fade-up tabular mt-(--card-gap-footer) type-chip text-foreground-soft delay-4 text-halo-strong">
      © {year} {personalData.name}
    </p>
  );
};
