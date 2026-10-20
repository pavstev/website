type BioPart<T> = { tail: string; term: T } | { text: string };

interface TextPiece {
  compound: boolean;
  text: string;
}

export const splitBio = <T extends { word: string }>(
  summary: string,
  terms: readonly T[]
): Array<BioPart<T>> => {
  const hits = terms
    .map((term) => {
      const index = summary.indexOf(term.word);
      if (index === -1) {
        throw new Error(`"${term.word}" is not in the summary`);
      }
      return { index, term };
    })
    .toSorted((a, b) => a.index - b.index);
  const parts: Array<BioPart<T>> = [];
  let cursor = 0;
  for (const { index, term } of hits) {
    if (index < cursor) throw new Error(`"${term.word}" overlaps a term`);
    if (index > cursor) parts.push({ text: summary.slice(cursor, index) });
    const end = index + term.word.length;
    const tail = /^\S*/u.exec(summary.slice(end))?.[0] ?? "";
    parts.push({ tail, term });
    cursor = end + tail.length;
  }
  if (cursor < summary.length) parts.push({ text: summary.slice(cursor) });
  return parts;
};

export const splitCompounds = (text: string): TextPiece[] => {
  const pieces: TextPiece[] = [];
  let plain = "";
  for (const piece of text.split(/(\s+)/u)) {
    if (/\S-\S/u.test(piece)) {
      if (plain !== "") pieces.push({ compound: false, text: plain });
      pieces.push({ compound: true, text: piece });
      plain = "";
    } else {
      plain += piece;
    }
  }
  if (plain !== "") pieces.push({ compound: false, text: plain });
  return pieces;
};
