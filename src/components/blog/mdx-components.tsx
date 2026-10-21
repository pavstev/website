import type { ComponentPropsWithoutRef, ReactElement } from "react";

import { BlogLink } from "@/components/blog/blog-link";
import { Chart } from "@/components/blog/chart";
import { CodeBlock } from "@/components/blog/code-block";
import { Diagram } from "@/components/blog/diagram";
import { Note } from "@/components/blog/note";
import { type ChartType } from "@/lib/blog/chart-data";
import { type DiagramName } from "@/lib/blog/diagrams";

interface ChartMdxProps {
  caption: string;
  src: string;
  title: string;
  type: ChartType;
}

interface DiagramMdxProps {
  caption: string;
  name: DiagramName;
}

interface PostFolder {
  dir: string;
  slug: string;
}

export const mdxComponents = ({
  dir,
  slug,
}: PostFolder): Record<string, (props: never) => ReactElement> => ({
  a: BlogLink,
  Chart: (props: ChartMdxProps) => <Chart {...props} dir={dir} slug={slug} />,
  Diagram: (props: DiagramMdxProps) => <Diagram {...props} />,
  Note,
  pre: (props: ComponentPropsWithoutRef<"pre">) => <CodeBlock {...props} />,
});
