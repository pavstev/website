import { instantMs, type PostMeta } from "./schema.ts";

export const modifiedOf = (meta: PostMeta): string => meta.updated ?? meta.date;

export const newestFirst = (a: string, b: string): number =>
  instantMs(b) - instantMs(a);

export const lastModified = (posts: readonly PostMeta[]): string | undefined =>
  posts.map((post) => modifiedOf(post)).toSorted(newestFirst)[0];
