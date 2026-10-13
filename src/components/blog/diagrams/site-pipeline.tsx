import type { ReactElement } from "react";

import { DiagramLine } from "@/components/blog/diagrams/diagram-line";
import { DiagramNode } from "@/components/blog/diagrams/diagram-node";
import { DiagramSvg } from "@/components/blog/diagrams/diagram-svg";
import { ink, size } from "@/lib/blog/diagram-ink";
import { sitePipeline } from "@/lib/blog/diagrams";

const spine = 10;
const branch = 38;
const firstY = 12;
const step = 54;
const subStep = 26;

export const SitePipeline = (): ReactElement => {
  const { builds, outputs, sources } = sitePipeline;
  const buildsY = firstY + sources.length * step;
  const subTop = buildsY + 28;
  const subBottom = subTop + (builds.steps.length - 1) * subStep;
  const outY = (index: number): number => subBottom + 40 + index * step;
  const lastY = outY(outputs.length - 1);
  return (
    <DiagramSvg height={lastY + 30} name="site-pipeline" width={192}>
      <DiagramLine x1={spine} x2={spine} y1={firstY} y2={lastY} />
      <DiagramLine x1={branch} x2={branch} y1={buildsY + 12} y2={subBottom} />
      {sources.map((source, index) => (
        <DiagramNode
          detail={source.detail}
          filled={false}
          key={source.label}
          label={source.label}
          x={spine}
          y={firstY + index * step}
        />
      ))}
      <DiagramNode
        detail=""
        filled={false}
        key={builds.label}
        label={builds.label}
        x={spine}
        y={buildsY}
      />
      {builds.steps.map((name, index) => {
        const y = subTop + index * subStep;
        return (
          <g key={name}>
            <circle cx={branch} cy={y} data-fc="dot" fill={ink.warm} r={3.5} />
            <text
              data-fc="text"
              fill={ink.soft}
              fontSize={size.detail}
              x={branch + 14}
              y={y + 4.5}
            >
              {name}
            </text>
          </g>
        );
      })}
      {outputs.map((output, index) => (
        <g key={output.label}>
          <DiagramLine
            x1={spine}
            x2={branch - 6}
            y1={outY(index)}
            y2={outY(index)}
          />
          <DiagramNode
            detail={output.detail}
            filled
            key={output.label}
            label={output.label}
            x={branch}
            y={outY(index)}
          />
        </g>
      ))}
    </DiagramSvg>
  );
};
