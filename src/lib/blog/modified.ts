import { type PostMeta } from "./schema.ts";

export const modifiedOf = (meta: PostMeta): string => meta.updated ?? meta.date;
