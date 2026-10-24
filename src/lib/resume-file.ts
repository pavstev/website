import { readFile } from "node:fs/promises";

const resumeFile = "src/assets/resume.pdf";

let loaded: Promise<Uint8Array> | undefined;

const loadOnce = async (): Promise<Uint8Array> => {
  try {
    return await readFile(resumeFile);
  } catch (error) {
    loaded = undefined;
    throw error;
  }
};

export const getResumePdf = (): Promise<Uint8Array> => {
  loaded ??= loadOnce();
  return loaded;
};
