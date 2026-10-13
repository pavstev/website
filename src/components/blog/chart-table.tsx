import { type ReactElement } from "react";

import { type ChartData, formatValue } from "@/lib/blog/chart-data";

interface ChartTableProps {
  data: ChartData;
  title: string;
}

export const ChartTable = ({ data, title }: ChartTableProps): ReactElement => (
  <div className="sr-only">
    <table>
      <caption>{title}</caption>
      <thead>
        <tr>
          <td />
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
            {data.series.map((series) => (
              <td key={series.name}>
                {formatValue(series.values[index] ?? 0, data.unit)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
