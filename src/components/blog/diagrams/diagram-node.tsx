import type { ReactElement } from "react";

import { ink, size } from "@/lib/blog/diagram-ink";

interface DiagramNodeProps {
  detail: string;
  filled: boolean;
  label: string;
  x: number;
  y: number;
}

export const DiagramNode = ({
  detail,
  filled,
  label,
  x,
  y,
}: DiagramNodeProps): ReactElement => (
  <g>
    <circle
      cx={x}
      cy={y}
      data-fc={filled ? "mark" : "hollow"}
      fill={filled ? ink.accent : ink.fill}
      r={6}
      stroke={ink.accent}
      strokeWidth={1.5}
    />
    <text
      data-fc="text"
      fill={ink.label}
      fontSize={size.label}
      fontWeight={600}
      x={x + 20}
      y={y + 5}
    >
      {label}
    </text>
    {detail === "" ? undefined : (
      <text
        data-fc="muted"
        fill={ink.detail}
        fontSize={size.detail}
        x={x + 20}
        y={y + 24}
      >
        {detail}
      </text>
    )}
  </g>
);
