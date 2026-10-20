import { instantMs, type PostMeta } from "./schema.ts";

export const modifiedOf = (meta: PostMeta): string => meta.updated ?? meta.date;

export const newestFirst = (a: string, b: string): number =>
  instantMs(b) - instantMs(a);
