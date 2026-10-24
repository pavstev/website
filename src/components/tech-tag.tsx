import type { CSSProperties, ReactElement } from "react";

import { Icon } from "@/components/icon";
import { type Tech } from "@/lib/tech-logos";

export const TechTag = ({ tech }: { tech: Tech }): ReactElement => (
  <span
    className="tech-tag"
    style={tech.color ? ({ "--tag": tech.color } as CSSProperties) : undefined}
  >
    {tech.logo ? (
      <Icon
        aria-hidden
        className="tech-logo"
        name={tech.logo}
        size="0.875rem"
      />
    ) : (
      <span aria-hidden className="tech-dot" />
    )}
    {tech.name}
  </span>
);
