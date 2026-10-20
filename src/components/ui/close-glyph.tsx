import type { ReactElement } from "react";

interface CloseGlyphProps {
  size: number;
}

export const CloseGlyph = ({ size }: CloseGlyphProps): ReactElement => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 256 256"
    width={size}
  >
    <line
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="16"
      x1="200"
      x2="56"
      y1="56"
      y2="200"
    />
    <line
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="16"
      x1="200"
      x2="56"
      y1="200"
      y2="56"
    />
  </svg>
);
