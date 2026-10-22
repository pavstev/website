export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const fieldsOf = (value: unknown): Map<string, unknown> | undefined =>
  isRecord(value) ? new Map(Object.entries(value)) : undefined;

export const readJson = <T>(
  raw: string | undefined,
  guard: (value: unknown) => value is T
): T | undefined => {
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return guard(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};
