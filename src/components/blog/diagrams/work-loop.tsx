import type { ReactElement } from "react";

import { DiagramLine } from "@/components/blog/diagrams/diagram-line";
import { DiagramNode } from "@/components/blog/diagrams/diagram-node";
import { DiagramSvg } from "@/components/blog/diagrams/diagram-svg";
import { ink } from "@/lib/blog/diagram-ink";
import { workLoop } from "@/lib/blog/diagrams";

const spine = 26;
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
      <DiagramLine x1={spine} x2={spine} y1={firstY} y2={lastY} />
      {workLoop.map((item, index) => (
        <DiagramNode
          detail={item.detail}
          filled={index === workLoop.length - 1}
          key={item.label}
          label={item.label}
          x={spine}
          y={firstY + index * step}
        />
      ))}
    </DiagramSvg>
  );
};
