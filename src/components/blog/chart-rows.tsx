import type { CSSProperties, ReactElement } from "react";

import { type ChartRow } from "@/lib/blog/chart-layout";
import { chartTone } from "@/lib/blog/diagram-ink";

interface ChartRowsProps {
  rows: ChartRow[];
}

const barStyle = (row: {
  fraction: number;
  tone: "before" | number;
}): CSSProperties => ({
  background: chartTone(row.tone),
  width: `${String(Math.round(row.fraction * 10_000) / 100)}%`,
});

export const ChartRows = ({ rows }: ChartRowsProps): ReactElement => (
  <div className="text-sm/snug tabular-nums">
    {rows.map((row, index) =>
      row.kind === "head" ? (
        <div
          className={`flex flex-wrap items-baseline justify-between gap-x-3 font-semibold text-(--foreground) ${index === 0 ? "" : "mt-5"}`}
          data-fc="text"
          key={row.key}
        >
          <span className="min-w-0">{row.label}</span>
          {row.aside === "" ? undefined : (
            <span
              className="font-normal text-(--foreground-soft)"
              data-fc="text"
            >
              {row.aside}
            </span>
          )}
        </div>
      ) : (
        <div className="mt-2.5" key={row.key}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span
              className={`min-w-0 ${row.quiet ? "text-(--muted-foreground)" : "text-(--foreground)"}`}
              data-fc={row.quiet ? "muted" : "text"}
            >
              {row.label}
            </span>
            <span className="ms-auto text-(--foreground)" data-fc="text">
              {row.value}
            </span>
          </div>
          <div
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-(--border)"
            data-fc="track"
          >
            {row.fraction > 0 ? (
              <div
                className="h-full rounded-full"
                data-fc={row.tone === "before" ? "before" : "mark"}
                style={barStyle(row)}
              />
            ) : undefined}
          </div>
        </div>
      )
    )}
  </div>
);
