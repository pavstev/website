import type { ReactElement } from "react";

import { DiagramSvg } from "@/components/blog/diagrams/diagram-svg";
import { ink, size } from "@/lib/blog/diagram-ink";
import { skyLayers } from "@/lib/blog/diagrams";

const planeHeight = 64;
const planeGap = 16;
const inset = 16;
const probeX = "88%";
const coronaX = "66%";
const stars: Array<[string, number, number]> = [
  ["70%", 10, 1.2],
  ["74%", 15, 1.4],
  ["79%", 53, 1],
  ["96%", 20, 1.2],
  ["94%", 48, 1],
];

const rays = Array.from(
  { length: 16 },
  (_, index) => (index / 16) * Math.PI * 2
);

export const SkyLayers = (): ReactElement => {
  const { layers } = skyLayers;
  const topOf = (index: number): number => index * (planeHeight + planeGap);
  const skyTop = topOf(layers.length - 1);
  const coronaTop = topOf(1);
  const height = skyTop + planeHeight + 1;
  return (
    <DiagramSvg height={height} name="sky-layers">
      {layers.map((layer, index) => {
        const top = topOf(index);
        const back = index === layers.length - 1;
        return (
          <g key={layer.label}>
            <rect
              data-fc="plane"
              fill={back ? ink.plane : "none"}
              height={planeHeight}
              rx={12}
              stroke={back ? "none" : ink.rim}
              strokeWidth={1}
              width="100%"
              x={0.5}
              y={top + 0.5}
            />
            <text
              data-fc="text"
              fill={ink.label}
              fontSize={size.label}
              fontWeight={600}
              style={{ fontSize: `min(${String(size.label)}px, 6cqw)` }}
              x={inset}
              y={top + 27}
            >
              {layer.label}
            </text>
            <text
              data-fc="muted"
              fill={ink.detail}
              fontSize={size.detail}
              style={{ fontSize: `min(${String(size.detail)}px, 6cqw)` }}
              x={inset}
              y={top + 46}
            >
              {layer.detail}
            </text>
          </g>
        );
      })}
      {stars.map(([x, y, r]) => (
        <circle
          cx={x}
          cy={skyTop + y}
          data-fc="dot"
          fill={ink.soft}
          key={`${x}-${String(y)}`}
          r={r}
        />
      ))}
      <svg
        className="overflow-visible"
        height={1}
        width={1}
        x={coronaX}
        y={coronaTop + planeHeight / 2}
      >
        {rays.map((angle, index) => (
          <line
            data-fc="line"
            key={angle}
            stroke={ink.warm}
            strokeLinecap="round"
            strokeOpacity={index % 2 === 0 ? 0.9 : 0.5}
            strokeWidth={1.25}
            x1={Math.cos(angle) * 17}
            x2={Math.cos(angle) * (index % 2 === 0 ? 24 : 21)}
            y1={Math.sin(angle) * 17}
            y2={Math.sin(angle) * (index % 2 === 0 ? 24 : 21)}
          />
        ))}
        <circle
          cx={0}
          cy={0}
          data-fc="hollow"
          fill={ink.fill}
          r={12}
          stroke={ink.warm}
          strokeWidth={1.5}
        />
      </svg>
      <line
        data-fc="line"
        stroke={ink.accent}
        strokeDasharray="3 4"
        strokeLinecap="round"
        strokeWidth={1.5}
        x1={probeX}
        x2={probeX}
        y1={planeHeight / 2 + 6}
        y2={skyTop + planeHeight / 2}
      />
      <circle
        cx={probeX}
        cy={skyTop + planeHeight / 2}
        data-fc="mark"
        fill={ink.accent}
        r={4}
      />
      <text
        className="font-mono"
        data-fc="text"
        fill={ink.accent}
        fontSize={size.mono}
        textAnchor="middle"
        x={probeX}
        y={planeHeight / 2}
      >
        {skyLayers.utility}
      </text>
      <text
        data-fc="text"
        dx={-10}
        fill={ink.soft}
        fontSize={size.detail}
        textAnchor="end"
        x={probeX}
        y={skyTop + planeHeight / 2 + 4.5}
      >
        {skyLayers.probe}
      </text>
    </DiagramSvg>
  );
};
