import type { ReactElement, ReactNode } from "react";

import { diagramMeta, type DiagramName } from "@/lib/blog/diagrams";

interface DiagramSvgProps {
  children: ReactNode;
  height: number;
  name: DiagramName;
  width?: number;
}

export const DiagramSvg = ({
  children,
  height,
  name,
  width,
}: DiagramSvgProps): ReactElement => {
  const id = `diagram-${name}`;
  const meta = diagramMeta[name];
  return (
    <svg
      aria-describedby={`${id}-desc`}
      aria-labelledby={`${id}-title`}
      className={
        width === undefined
          ? "block overflow-visible"
          : "block h-auto w-full overflow-visible"
      }
      height={height}
      role="img"
      style={
        width === undefined ? undefined : { maxWidth: `${String(width)}px` }
      }
      viewBox={
        width === undefined
          ? undefined
          : `0 0 ${String(width)} ${String(height)}`
      }
      width={width ?? "100%"}
    >
      <title id={`${id}-title`}>{meta.title}</title>
      <desc id={`${id}-desc`}>{meta.desc}</desc>
      {children}
    </svg>
  );
};
