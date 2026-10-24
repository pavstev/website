import type { ReactElement, ReactNode } from "react";

import { diagramMeta, type DiagramName } from "@/lib/blog/diagrams";

interface DiagramBoxProps {
  children: ReactNode;
  name: DiagramName;
}

export const DiagramBox = ({
  children,
  name,
}: DiagramBoxProps): ReactElement => {
  const id = `diagram-${name}`;
  const meta = diagramMeta[name];
  return (
    <div
      aria-describedby={`${id}-desc`}
      aria-labelledby={`${id}-title`}
      role="img"
    >
      <span hidden id={`${id}-title`}>
        {meta.title}
      </span>
      <span hidden id={`${id}-desc`}>
        {meta.desc}
      </span>
      {children}
    </div>
  );
};
