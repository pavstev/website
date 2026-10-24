import {
  type ChartData,
  chartMax,
  formatValue,
  niceTicks,
  pairChange,
  spreadLabels,
  tickLabels,
} from "./chart-data.ts";

export type ChartRow = HeadRow | MeterRow;

export interface LineLayout {
  bottom: number;
  gutter: number;
  height: number;
  series: LineSeries[];
  ticks: Array<{ label: string; value: number; y: number }>;
  top: number;
  unit: string;
  xLabels: Array<{
    anchor: "end" | "middle" | "start";
    label: string;
    x: number;
  }>;
}

export interface MeterRow {
  fraction: number;
  key: string;
  kind: "meter";
  label: string;
  quiet: boolean;
  tone: "before" | number;
  value: string;
}

interface HeadRow {
  aside: string;
  key: string;
  kind: "head";
  label: string;
}

interface LinePoint {
  x: number;
  y: number;
}

interface LineSeries {
  dash: string;
  end: { lines: string[]; text: string; y: number };
  name: string;
  points: LinePoint[];
  tone: number;
}

const seriesDashes = ["", "6 4", "1.5 4", "10 3 2 3"] as const;

export const fractionOf = (value: number, max: number): number =>
  max > 0 && value > 0 ? Math.max(value / max, 0.01) : 0;

export const barRows = (data: ChartData): ChartRow[] => {
  const max = chartMax(data);
  const [only] = data.series;
  if (only && data.series.length === 1)
    return data.x.map((label, index) => {
      const value = only.values[index] ?? 0;
      return {
        fraction: fractionOf(value, max),
        key: label,
        kind: "meter",
        label,
        quiet: false,
        tone: 0,
        value: formatValue(value, data.unit),
      };
    });
  return data.x.flatMap((label, index): ChartRow[] => [
    { aside: "", key: `head-${label}`, kind: "head", label },
    ...data.series.map((series, tone): ChartRow => {
      const value = series.values[index] ?? 0;
      return {
        fraction: fractionOf(value, max),
        key: `${label}-${series.name}`,
        kind: "meter",
        label: series.name,
        quiet: true,
        tone,
        value: formatValue(value, data.unit),
      };
    }),
  ]);
};

export const pairRows = (data: ChartData): ChartRow[] => {
  const max = chartMax(data);
  const [before = "", after = ""] = data.x;
  return data.series.flatMap((series, tone): ChartRow[] => {
    const [from = 0, to = 0] = series.values;
    return [
      {
        aside: pairChange(from, to),
        key: `head-${series.name}`,
        kind: "head",
        label: series.name,
      },
      {
        fraction: fractionOf(from, max),
        key: `${series.name}-before`,
        kind: "meter",
        label: before,
        quiet: true,
        tone: "before",
        value: formatValue(from, data.unit),
      },
      {
        fraction: fractionOf(to, max),
        key: `${series.name}-after`,
        kind: "meter",
        label: after,
        quiet: true,
        tone,
        value: formatValue(to, data.unit),
      },
    ];
  });
};

const lineTop = 22;
const plotHeight = 168;
const axisHeight = 30;
const labelGap = 15;
const lineGap = 14;
const tickCharWidth = 7.2;
const gutterPad = 8;
const endLabelSpan = 0.7;

const anchorOf = (index: number, count: number): "end" | "middle" | "start" => {
  if (count === 1) return "middle";
  if (index === 0) return "start";
  return index === count - 1 ? "end" : "middle";
};

export const lineLayout = (data: ChartData): LineLayout => {
  const values = niceTicks(chartMax(data), 4);
  const top = values.at(-1) ?? 1;
  const yOf = (value: number): number =>
    lineTop + plotHeight * (1 - value / top);
  const count = data.x.length;
  const xOf = (index: number): number =>
    count === 1 ? 0.5 : index / (count - 1);
  const multi = data.series.length > 1;
  const lasts = data.series.map((series) => series.values.at(-1) ?? 0);
  const highest = Math.max(...lasts);
  const lowest = Math.min(...lasts);
  const spread = multi && highest > lowest;
  const below = (index: number): boolean => {
    const last = lasts[index] ?? 0;
    return spread && (last === highest || last === lowest)
      ? last === lowest
      : (data.series[index]?.values.at(-2) ?? last) > last;
  };
  const extra = multi ? lineGap : 0;
  const tailPeak = (index: number): number =>
    Math.max(
      ...(data.series[index]?.values ?? []).filter(
        (_, at) => xOf(at) >= endLabelSpan
      )
    );
  const wanted = lasts.map((last, index) => {
    if (below(index)) return yOf(last) + 19;
    const anchor = spread && last === highest ? tailPeak(index) : last;
    return yOf(anchor) - 10 - extra;
  });
  const endY = spreadLabels(wanted, labelGap + extra, 12);
  const tickUnit = data.unit === "%" ? "%" : "";
  const tickText = values.map((value) =>
    value === 0 ? "" : formatValue(value, tickUnit)
  );
  const widest = Math.max(...tickText.map((text) => text.length));
  const longest = Math.max(...data.x.map((label) => label.length));
  const bottom = lineTop + plotHeight;
  return {
    bottom,
    gutter: Math.ceil(widest * tickCharWidth) + gutterPad,
    height: bottom + axisHeight,
    series: data.series.map((series, tone) => {
      const value = formatValue(series.values.at(-1) ?? 0, data.unit);
      return {
        dash: seriesDashes[tone % seriesDashes.length] ?? "",
        end: {
          lines: multi ? [series.name, value] : [value],
          text: multi ? `${series.name} ${value}` : value,
          y: endY[tone] ?? 0,
        },
        name: series.name,
        points: series.values.map((point, index) => ({
          x: xOf(index),
          y: yOf(point),
        })),
        tone,
      };
    }),
    ticks: values.map((value, index) => ({
      label: tickText[index] ?? "",
      value,
      y: yOf(value),
    })),
    top: lineTop,
    unit: data.unit === "%" ? "" : data.unit,
    xLabels: tickLabels(count, longest >= 6 ? 4 : 6).map((index) => ({
      anchor: anchorOf(index, count),
      label: data.x[index] ?? "",
      x: xOf(index),
    })),
  };
};
