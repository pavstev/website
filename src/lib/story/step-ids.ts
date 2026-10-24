export const stepOrder = [
  "hero",
  "c01",
  "c02",
  "c03",
  "c04",
  "c05",
  "c06",
  "harness",
  "h1",
  "h2",
  "h3",
  "skills",
  "outro",
] as const;

export type StepId = (typeof stepOrder)[number];

const known: ReadonlySet<string> = new Set(stepOrder);

export const isStepId = (value: string | undefined): value is StepId =>
  value !== undefined && known.has(value);
