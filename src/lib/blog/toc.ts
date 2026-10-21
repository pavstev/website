export interface TocItem {
  depth: 2 | 3;
  id: string;
  text: string;
}

interface Heading {
  depth: number;
  slug: string;
  text: string;
}

const footnoteLabel = "footnote-label";

export const tocOf = (headings: readonly Heading[]): TocItem[] =>
  headings.flatMap(({ depth, slug, text }): TocItem[] =>
    (depth === 2 || depth === 3) && !slug.endsWith(footnoteLabel)
      ? [
          {
            depth,
            id: slug,
            text: text.replaceAll(/\s+/g, " ").trim().replace(/#$/u, "").trim(),
          },
        ]
      : []
  );

const currentSection = (tops: readonly number[], line: number): number =>
  tops.findLastIndex((top) => top <= line);

export const spySection = (
  tops: readonly number[],
  offset: number,
  viewport: number,
  ratio: number
): number =>
  ratio >= 1
    ? tops.length - 1
    : currentSection(
        tops,
        offset + 1 + Math.max(0, ratio) * Math.max(0, viewport - offset - 1)
      );

export const branchOf = (
  items: readonly TocItem[],
  index: number
): "last" | "mid" | undefined =>
  items[index]?.depth === 3
    ? items[index + 1]?.depth === 3
      ? "mid"
      : "last"
    : undefined;
