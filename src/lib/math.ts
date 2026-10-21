export const deg = Math.PI / 180;

export const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

export const clamp01 = (value: number): number => clamp(value, 0, 1);

const mixAny = (from: unknown, to: unknown, share: number): unknown => {
  if (typeof from === "number" && typeof to === "number") {
    return from * (1 - share) + to * share;
  }
  if (Array.isArray(from) && Array.isArray(to)) {
    return from.map((item: unknown, index) => mixAny(item, to[index], share));
  }
  if (
    typeof from === "object" &&
    from !== null &&
    typeof to === "object" &&
    to !== null
  ) {
    return Object.fromEntries(
      Object.entries(from).map(([key, item]) => [
        key,
        mixAny(item, Reflect.get(to, key), share),
      ])
    );
  }
  return from;
};

export const mix = <T>(from: T, to: T, share: number): T =>
  mixAny(from, to, share) as T;

export const smoothstep = (from: number, to: number, value: number): number => {
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};
