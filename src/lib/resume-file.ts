import { readFile } from "node:fs/promises";

import { getCv } from "./cv.ts";
import { personalData } from "./personal.ts";
import { renderResumePdf } from "./resume-pdf.ts";

const photoFile = "public/stevan-pavlovic.jpeg";

const photoHref = new URL("/stevan-pavlovic.jpeg", personalData.website).href;

const isKnownPhoto = (pictureUrl: string): boolean =>
  URL.canParse(pictureUrl) && new URL(pictureUrl).href === photoHref;

type Reader = (file: string) => Promise<Uint8Array>;

export const readPhoto = async (
  pictureUrl: string,
  read: Reader = readFile
): Promise<null | Uint8Array> => {
  if (!isKnownPhoto(pictureUrl)) return null;
  try {
    return await read(photoFile);
  } catch {
    return null;
  }
};

const render = async (): Promise<Uint8Array> => {
  const cv = await getCv();
  return renderResumePdf(cv, await readPhoto(cv.basics.pictureUrl));
};

let rendered: Promise<Uint8Array> | undefined;

const renderOnce = async (): Promise<Uint8Array> => {
  try {
    return await render();
  } catch (error) {
    rendered = undefined;
    throw error;
  }
};

export const getResumePdf = (): Promise<Uint8Array> => {
  rendered ??= renderOnce();
  return rendered;
};
