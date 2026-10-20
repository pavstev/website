import { type ReactElement } from "react";

import { type ChartData, formatValue } from "@/lib/blog/chart-data";
import { en } from "@/lib/i18n";

interface ChartTableProps {
  data: ChartData;
  title: string;
}

export const ChartTable = ({ data, title }: ChartTableProps): ReactElement => (
  <details className="chart-data">
    <summary className="chart-data-summary mat-cap focus-ring">
      {en.blog.chartData}
    </summary>
    <div className="chart-data-body mat-panel" data-sortable-table="">
      <table>
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">{en.blog.chartColumn}</th>
            {data.series.map((series) => (
              <th key={series.name} scope="col">
                {series.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.x.map((label, index) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {data.series.map((series) => {
                const value = series.values[index] ?? 0;
                return (
                  <td data-value={String(value)} key={series.name}>
                    {formatValue(value, data.unit)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </details>
);
