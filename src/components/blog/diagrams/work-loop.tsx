import type { ReactElement } from "react";

import { DiagramSvg } from "@/components/blog/diagrams/diagram-svg";
import { ink, size } from "@/lib/blog/diagram-ink";
import { workLoop } from "@/lib/blog/diagrams";

const spine = 26;
const textX = 46;
const firstY = 16;
const step = 54;
const loopX = 6;

export const WorkLoop = (): ReactElement => {
  const lastY = firstY + (workLoop.length - 1) * step;
  return (
    <DiagramSvg height={lastY + 30} name="work-loop" width={240}>
      <path
        d={`M ${String(spine - 7)} ${String(lastY)} H ${String(loopX + 6)} Q ${String(loopX)} ${String(lastY)} ${String(loopX)} ${String(lastY - 6)} V ${String(firstY + 6)} Q ${String(loopX)} ${String(firstY)} ${String(loopX + 6)} ${String(firstY)} H ${String(spine - 9)}`}
        data-fc="line"
        fill="none"
        stroke={ink.line}
        strokeDasharray="2 4"
        strokeLinecap="round"
        strokeWidth={1.25}
      />
      <path
        d={`M ${String(spine - 13)} ${String(firstY - 3.5)} L ${String(spine - 8)} ${String(firstY)} L ${String(spine - 13)} ${String(firstY + 3.5)}`}
        data-fc="line"
        fill="none"
        stroke={ink.line}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.25}
      />
      <line
        data-fc="line"
        stroke={ink.line}
        strokeWidth={1.25}
        x1={spine}
        x2={spine}
        y1={firstY}
        y2={lastY}
      />
      {workLoop.map((item, index) => {
        const y = firstY + index * step;
        const last = index === workLoop.length - 1;
        return (
          <g key={item.label}>
            <circle
              cx={spine}
              cy={y}
              data-fc={last ? "mark" : "hollow"}
              fill={last ? ink.accent : ink.fill}
              r={6}
              stroke={ink.accent}
              strokeWidth={1.5}
            />
            <text
              data-fc="text"
              fill={ink.label}
              fontSize={size.label}
              fontWeight={600}
              x={textX}
              y={y + 5}
            >
              {item.label}
            </text>
            <text
              data-fc="muted"
              fill={ink.detail}
              fontSize={size.detail}
              x={textX}
              y={y + 24}
            >
              {item.detail}
            </text>
          </g>
        );
      })}
    </DiagramSvg>
  );
};
