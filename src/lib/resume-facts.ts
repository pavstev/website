import { inflateSync } from "node:zlib";

import { getResumePdf } from "./resume-file.ts";

export interface ResumeFacts {
  kilobytes: number;
  pages: number;
}

const pagePattern = /\/Type\s*\/Page(?![A-Za-z])/g;
const pagesPattern = /<<[^<>]*\/Type\s*\/Pages(?![A-Za-z])[^<>]*>>/g;
const countPattern = /\/Count\s+(\d+)/;
const streamPattern = /stream\r?\n/g;

const objectStreams = (raw: Buffer, text: string): string[] => {
  const decoded: string[] = [];
  for (const match of text.matchAll(streamPattern)) {
    const head = text.slice(text.lastIndexOf("obj", match.index), match.index);
    if (!head.includes("/ObjStm") || !head.includes("/FlateDecode")) continue;
    const start = match.index + match[0].length;
    const end = text.indexOf("endstream", start);
    if (end === -1) continue;
    try {
      decoded.push(inflateSync(raw.subarray(start, end)).toString("latin1"));
    } catch {
      continue;
    }
  }
  return decoded;
};

const countPages = (text: string): number => {
  const counts = text
    .matchAll(pagesPattern)
    .map((match) => Number(countPattern.exec(match[0])?.[1] ?? 0))
    .toArray();
  const fromTree = Math.max(0, ...counts);
  return fromTree > 0 ? fromTree : (text.match(pagePattern)?.length ?? 0);
};

export const readResumeFacts = (pdf: Uint8Array): ResumeFacts => {
  const raw = Buffer.from(pdf.buffer, pdf.byteOffset, pdf.byteLength);
  const text = raw.toString("latin1");
  const pages = countPages([text, ...objectStreams(raw, text)].join("\n"));
  if (pages === 0) {
    throw new Error("resume PDF: no page count found");
  }
  return { kilobytes: Math.round(raw.byteLength / 1024), pages };
};

export const getResumeFacts = async (): Promise<ResumeFacts> =>
  readResumeFacts(await getResumePdf());
