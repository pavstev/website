export interface Baseline {
  label: string;
  results: Result[];
}
export type Check = (context: Context) => Promise<Result>;

export interface Context {
  base: string;
  baseline: Baseline | undefined;
  baselineDir: string | undefined;
  fast: boolean;
  local: boolean;
  out: string;
  pages: Page[];
  sitemap: string;
}

export type Level = "fail" | "info" | "warn";

export interface Page {
  kind: string;
  live: string | undefined;
  path: string;
  url: string;
}

export interface Result {
  lines: string[];
  metrics: Record<string, number>;
  name: string;
  seconds?: number;
  status: Status;
  summary: string;
}

type Status = "fail" | "pass" | "skip" | "warn";
