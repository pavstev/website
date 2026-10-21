import * as z from "zod";

const nonEmpty = z.string().trim().min(1);

export const aboutSchema = z.strictObject({
  description: nonEmpty.max(160),
  title: nonEmpty,
});
