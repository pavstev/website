import { readFile } from "node:fs/promises";

import { type Cv, cvSchema } from "./cv-schema.ts";

export { type Cv, cvSchema } from "./cv-schema.ts";

const cvPath = "src/data/cv.json";

export const stripPrivate = (cv: Cv): Cv => ({
  ...cv,
  basics: { ...cv.basics, phone: "" },
});

export const parseCv = (data: unknown, label: string): Cv => {
  const parsed = cvSchema.safeParse(data);
  if (!parsed.success) {
    const fields = parsed.error.issues
      .map((issue) => issue.path.join(".") || "(root)")
      .join(", ");
    throw new Error(`${label} does not match the résumé schema: ${fields}`);
  }
  return stripPrivate(parsed.data);
};

const readCv = async (): Promise<Cv> => {
  let file: string;
  try {
    file = await readFile(cvPath, "utf8");
  } catch {
    throw new Error(`${cvPath} is missing`);
  }
  let data: unknown;
  try {
    data = JSON.parse(file);
  } catch {
    throw new Error(`${cvPath} is not JSON`);
  }
  return parseCv(data, cvPath);
};

let cached: Promise<Cv> | undefined;

const readCvOnce = async (): Promise<Cv> => {
  try {
    return await readCv();
  } catch (error) {
    cached = undefined;
    throw error;
  }
};

export const getCv = (): Promise<Cv> => {
  cached ??= readCvOnce();
  return cached;
};
