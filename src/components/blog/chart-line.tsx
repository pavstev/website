import type { ReactElement } from "react";

import { type ChartData } from "@/lib/blog/chart-data";
import { lineLayout } from "@/lib/blog/chart-layout";
import { chartTone, ink, size } from "@/lib/blog/diagram-ink";

interface ChartLineProps {
  data: ChartData;
}

const plotWidth = 1000;

const percent = (value: number): string =>
  `${String(Math.round(value * 10_000) / 100)}%`;

export const ChartLine = ({ data }: ChartLineProps): ReactElement => {
  const layout = lineLayout(data);
  const plotHeight = layout.bottom - layout.top;
  return (
    <>
      {layout.series.length > 1 ? (
        <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-(--foreground-soft)">
          {layout.series.map((series) => (
            <li className="flex items-center gap-2" key={series.name}>
              <svg height={10} width={22}>
                <line
                  data-fc="series"
                  stroke={chartTone(series.tone)}
                  strokeDasharray={series.dash || undefined}
                  strokeLinecap="round"
                  strokeWidth={2}
                  x1={1}
                  x2={21}
                  y1={5}
                  y2={5}
                />
              </svg>
              <span data-fc="text">{series.name}</span>
            </li>
          ))}
        </ul>
      ) : undefined}
      <div style={{ paddingLeft: layout.gutter }}>
        <svg
          className="block overflow-visible tabular-nums"
          height={layout.height}
          width="100%"
        >
          {layout.unit === "" ? undefined : (
            <text
              data-fc="muted"
              fill={ink.detail}
              fontSize={size.tick}
              x={0}
              y={layout.top - 8}
            >
              {layout.unit}
            </text>
          )}
          {layout.ticks.map((tick) => (
            <g key={`tick-${String(tick.value)}`}>
              <line
                data-fc="grid"
                stroke={ink.plane}
                strokeWidth={1}
                x1={0}
                x2="100%"
                y1={tick.y}
                y2={tick.y}
              />
              {tick.label === "" ? undefined : (
                <text
                  data-fc="muted"
                  fill={ink.detail}
                  fontSize={size.tick}
                  textAnchor="end"
                  x={-6}
                  y={tick.y + 4}
                >
                  {tick.label}
                </text>
              )}
            </g>
          ))}
          <svg
            className="overflow-visible"
            height={plotHeight}
            preserveAspectRatio="none"
            viewBox={`0 ${String(layout.top)} ${String(plotWidth)} ${String(plotHeight)}`}
            width="100%"
            x={0}
            y={layout.top}
          >
            {layout.series.map((series) => (
              <polyline
                data-fc="series"
                fill="none"
                key={series.name}
                points={series.points
                  .map(
                    (point) =>
                      `${String(point.x * plotWidth)},${String(point.y)}`
                  )
                  .join(" ")}
                stroke={chartTone(series.tone)}
                strokeDasharray={series.dash || undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          {layout.series.map((series) =>
            series.points.map((point, index) => (
              <circle
                cx={percent(point.x)}
                cy={point.y}
                data-fc="dot"
                fill={chartTone(series.tone)}
                key={`${series.name}-${String(index)}`}
                r={3.5}
                stroke={ink.fill}
                strokeWidth={2}
              />
            ))
          )}
          {layout.series.map((series) => (
            <text
              data-fc="text"
              fill={
                layout.series.length > 1 ? chartTone(series.tone) : ink.label
              }
              fontSize={13}
              key={`end-${series.name}`}
              textAnchor="end"
              x="100%"
              y={series.end.y}
            >
              {series.end.lines.map((line, index) => (
                <tspan
                  dx={-8}
                  dy={index === 0 ? undefined : 14}
                  key={line}
                  x="100%"
                >
                  {line}
                </tspan>
              ))}
            </text>
          ))}
          {layout.xLabels.map((label) => (
            <text
              data-fc="muted"
              fill={ink.detail}
              fontSize={size.tick}
              key={`x-${label.label}`}
              textAnchor={label.anchor}
              x={percent(label.x)}
              y={layout.bottom + 20}
            >
              {label.label}
            </text>
          ))}
        </svg>
      </div>
    </>
  );
};
