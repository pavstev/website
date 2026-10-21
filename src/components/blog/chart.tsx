import type { ReactElement } from "react";

import { ChartLine } from "@/components/blog/chart-line";
import { ChartRows } from "@/components/blog/chart-rows";
import { ChartTable } from "@/components/blog/chart-table";
import {
  chartId,
  chartLines,
  type ChartType,
  readChartFile,
} from "@/lib/blog/chart-data";
import { barRows, pairRows } from "@/lib/blog/chart-layout";

interface ChartProps {
  caption: string;
  dir: string;
  slug: string;
  src: string;
  title: string;
  type: ChartType;
}

export const Chart = ({
  caption,
  dir,
  slug,
  src,
  title,
  type,
}: ChartProps): ReactElement => {
  const data = readChartFile(dir, src, type);
  const id = chartId(slug, { src, title, type });
  return (
    <figure className="blog-figure blog-viz">
      <div
        aria-describedby={`${id}-desc`}
        aria-labelledby={`${id}-title`}
        className="text-left"
        role="img"
      >
        <span hidden id={`${id}-title`}>
          {title}
        </span>
        <span hidden id={`${id}-desc`}>
          {chartLines(data).join("; ")}
        </span>
        {type === "line" ? (
          <ChartLine data={data} />
        ) : (
          <ChartRows rows={type === "pair" ? pairRows(data) : barRows(data)} />
        )}
      </div>
      <ChartTable data={data} title={title} />
      <figcaption>{caption}</figcaption>
    </figure>
  );
};
