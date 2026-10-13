import type { ReactElement } from "react";

import { SitePipeline } from "@/components/blog/diagrams/site-pipeline";
import { SkillMap } from "@/components/blog/diagrams/skill-map";
import { SkyLayers } from "@/components/blog/diagrams/sky-layers";
import { WorkLoop } from "@/components/blog/diagrams/work-loop";
import { type DiagramName } from "@/lib/blog/diagrams";

interface DiagramProps {
  caption: string;
  name: DiagramName;
}

const drawings: Record<DiagramName, () => ReactElement> = {
  "site-pipeline": SitePipeline,
  "skill-map": SkillMap,
  "sky-layers": SkyLayers,
  "work-loop": WorkLoop,
};

export const Diagram = ({ caption, name }: DiagramProps): ReactElement => {
  if (!Object.hasOwn(drawings, name))
    throw new Error(`Unknown diagram "${name}"`);
  const Drawing = drawings[name];
  return (
    <figure className="blog-figure blog-viz">
      <div className="@container mx-auto max-w-xl text-left">
        <Drawing />
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
};
