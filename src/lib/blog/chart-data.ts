import { readFileSync } from "node:fs";
import path from "node:path";
import * as z from "zod";

const chartTypes = ["bar", "line", "pair"] as const;

export type ChartType = (typeof chartTypes)[number];

export const isChartType = (value: string): value is ChartType =>
  (chartTypes as readonly string[]).includes(value);

const idPart = (value: string): string =>
  value
    .toLowerCase()
    .replaceAll(/[^\da-z]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");

export const chartId = (
  slug: string,
  chart: { src: string; title: string; type: ChartType }
): string =>
  ["chart", slug, chart.type, idPart(chart.title), idPart(chart.src)]
    .filter((part) => part !== "")
    .join("-");

const seriesSchema = z.object({
  name: z.string().trim().min(1),
  values: z.array(z.number().nonnegative()),
});

const firstRepeat = (values: string[]): number =>
  values.findIndex((value, index) => values.indexOf(value) !== index);

const chartDataSchema = z
  .object({
    series: z.array(seriesSchema).min(1).max(4),
    unit: z.string(),
    x: z.array(z.string().trim().min(1)).min(1),
  })
  .superRefine((data, context) => {
    const x = firstRepeat(data.x);
    if (x !== -1)
      context.addIssue({
        code: "custom",
        message: `repeats the label "${data.x[x] ?? ""}"`,
        path: ["x", x],
      });
    const names = data.series.map((series) => series.name);
    const name = firstRepeat(names);
    if (name !== -1)
      context.addIssue({
        code: "custom",
        message: `repeats the series name "${names[name] ?? ""}"`,
        path: ["series", name, "name"],
      });
    for (const [index, series] of data.series.entries()) {
      if (series.values.length !== data.x.length)
        context.addIssue({
          code: "custom",
          message: `has ${String(series.values.length)} values for ${String(data.x.length)} x labels`,
          path: ["series", index, "values"],
        });
    }
  });

export type ChartData = z.infer<typeof chartDataSchema>;

export const parseChartData = (
  raw: unknown,
  type: ChartType,
  file: string
): ChartData => {
  const parsed = chartDataSchema.safeParse(raw);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    const field = issue ? issue.path.map(String).join(".") : "";
    throw new Error(`${file}: ${field}: ${issue?.message ?? "invalid"}`);
  }
  if (type === "pair" && parsed.data.x.length !== 2)
    throw new Error(
      `${file}: x: a pair chart needs exactly 2 x labels, found ${String(parsed.data.x.length)}`
    );
  return parsed.data;
};

const segmentPattern = /^[a-z\d][\w.-]*$/i;

const isSafeSrc = (src: string): boolean =>
  src.endsWith(".json") &&
  src.split("/").every((segment) => segmentPattern.test(segment));

export const readChartFile = (
  dir: string,
  src: string,
  type: ChartType
): ChartData => {
  if (!isSafeSrc(src))
    throw new Error(
      `Invalid chart src "${src}": use a .json path inside the post folder`
    );
  const file = path.join(dir, src);
  const text = readFileSync(file, "utf8");
  return parseChartData(JSON.parse(text) as unknown, type, file);
};

const roundTo = (value: number): number => Number(value.toPrecision(12));

export const niceTicks = (max: number, count: number): number[] => {
  if (!(max > 0) || !Number.isFinite(max)) return [0, 1];
  const raw = max / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const factor = [1, 2, 2.5, 5, 10].find(
    (candidate) => candidate * magnitude >= raw - 1e-12
  );
  const step = roundTo((factor ?? 10) * magnitude);
  const steps = Math.ceil(roundTo(max / step) - 1e-9);
  return Array.from({ length: steps + 1 }, (_, index) => roundTo(index * step));
};

const numberFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

const formatNumber = (value: number): string => numberFormat.format(value);

export const formatValue = (value: number, unit: string): string => {
  const number = formatNumber(value);
  if (unit === "") return number;
  return unit === "%" ? `${number}%` : `${number}\u{A0}${unit}`;
};

export const tickLabels = (count: number, most = 6): number[] => {
  const all = Array.from({ length: count }, (_, index) => index);
  if (count <= most) return all;
  const step = Math.ceil(count / Math.max(1, most - 1));
  const last = count - 1;
  return [
    ...all.filter((index) => index % step === 0 && last - index >= step),
    last,
  ];
};

interface LabelCluster {
  items: LabelEntry[];
  start: number;
}

interface LabelEntry {
  index: number;
  y: number;
}

const tailOverlaps = (clusters: LabelCluster[], gap: number): boolean => {
  const current = clusters.at(-1);
  const previous = clusters.at(-2);
  return Boolean(
    current &&
    previous &&
    previous.start + previous.items.length * gap > current.start
  );
};

const mergeTail = (
  clusters: LabelCluster[],
  gap: number,
  min: number
): void => {
  while (tailOverlaps(clusters, gap)) {
    const items = clusters.slice(-2).flatMap((cluster) => cluster.items);
    const mean =
      items.reduce((sum, entry, at) => sum + entry.y - at * gap, 0) /
      items.length;
    clusters.splice(-2, 2, { items, start: Math.max(mean, min) });
  }
};

export const spreadLabels = (
  wanted: number[],
  gap: number,
  min: number
): number[] => {
  const order = wanted
    .map((y, index) => ({ index, y }))
    .toSorted((a, b) => a.y - b.y);
  const clusters: LabelCluster[] = [];
  for (const item of order) {
    clusters.push({ items: [item], start: Math.max(item.y, min) });
    mergeTail(clusters, gap, min);
  }
  const placed = Array.from({ length: wanted.length }, () => 0);
  for (const cluster of clusters)
    for (const [at, entry] of cluster.items.entries())
      placed[entry.index] = cluster.start + at * gap;
  return placed;
};

export const pairChange = (before: number, after: number): string => {
  if (before === 0) return "";
  const percent = Math.round(((after - before) / before) * 100);
  if (percent === 0) return "0%";
  return `${percent < 0 ? "\u{2212}" : "+"}${formatNumber(Math.abs(percent))}%`;
};

export const chartLines = (data: ChartData): string[] =>
  data.x.map((label, index) => {
    const values = data.series.map((series) => {
      const value = formatValue(series.values[index] ?? 0, data.unit);
      return data.series.length === 1 ? value : `${series.name} ${value}`;
    });
    return `${label}: ${values.join(", ")}`;
  });

export const chartMax = (data: ChartData): number =>
  Math.max(0, ...data.series.flatMap((series) => series.values));
