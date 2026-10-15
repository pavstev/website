import type { ReactElement } from "react";

import { motion } from "motion/react";

type MorphShape = "pause" | "play";

const shapes: Record<MorphShape, readonly string[]> = {
  pause: [
    "M 8 5 L 11.5 5 L 11.5 19 L 8 19 Z",
    "M 15 5 L 18.5 5 L 18.5 19 L 15 19 Z",
  ],
  play: [
    "M 8 5 L 14 8.5 L 14 15.5 L 8 19 Z",
    "M 14 8.5 L 20 12 L 20 12 L 14 15.5 Z",
  ],
};

const cell = {
  damping: 34,
  mass: 0.45,
  stiffness: 520,
  type: "spring",
} as const;

interface IconMorphProps {
  shape: MorphShape;
  size?: number;
}

export const IconMorph = ({
  shape,
  size = 20,
}: IconMorphProps): ReactElement => (
  <svg
    aria-hidden="true"
    className="motion-icon"
    fill="currentColor"
    focusable="false"
    height={size}
    viewBox="0.6 0 24 24"
    width={size}
  >
    {shapes[shape].map((d, index) => (
      <motion.path
        animate={{ d }}
        initial={false}
        key={index}
        transition={cell}
      />
    ))}
  </svg>
);
