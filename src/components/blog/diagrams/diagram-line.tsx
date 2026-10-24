import type { ReactElement } from "react";

import { ink } from "@/lib/blog/diagram-ink";

interface DiagramLineProps {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export const DiagramLine = ({
  x1,
  x2,
  y1,
  y2,
}: DiagramLineProps): ReactElement => (
  <line
    data-fc="line"
    stroke={ink.line}
    strokeWidth={1.25}
    x1={x1}
    x2={x2}
    y1={y1}
    y2={y2}
  />
);
