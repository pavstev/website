import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";

import { evaluate } from "@mdx-js/mdx";
import rehypeShiki from "@shikijs/rehype";
import { transformerNotationHighlight } from "@shikijs/transformers";
import * as runtime from "react/jsx-runtime";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { createCssVariablesTheme } from "shiki";
import { VFile } from "vfile";

import { BlogImage } from "@/components/blog/blog-image";
import { BlogLink } from "@/components/blog/blog-link";
import { Chart } from "@/components/blog/chart";
import { Diagram } from "@/components/blog/diagram";
import { Figure } from "@/components/blog/figure";
import { Note } from "@/components/blog/note";
import { rehypeHeadingAnchors } from "@/lib/blog/anchors";
import { type ChartType } from "@/lib/blog/chart-data";
import { type DiagramName } from "@/lib/blog/diagrams";
import { type PostSource } from "@/lib/blog/posts";
import { rehypeToc, type TocItem } from "@/lib/blog/toc";
import { en } from "@/lib/i18n";

const theme = createCssVariablesTheme({
  fontStyle: true,
  name: "site",
  variableDefaults: {},
  variablePrefix: "--shiki-",
});

const languages = [
  "bash",
  "css",
  "diff",
  "glsl",
  "html",
  "json",
  "jsx",
  "md",
  "mdx",
  "tsx",
  "typescript",
  "yaml",
];

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

interface FigureProps {
  alt: string;
  caption?: string;
  src: string;
}

interface ImageProps {
  alt?: string | undefined;
  src?: string | undefined;
}

interface NoteProps {
  children?: ReactNode;
}

export const renderPost = async (
  source: PostSource
): Promise<{ content: ReactElement; toc: TocItem[] }> => {
  const { slug } = source;
  let firstImage = true;
  const takeFirst = (): boolean => {
    const first = firstImage;
    firstImage = false;
    return first;
  };
  const file = new VFile({
    path: `${source.dir}/index.mdx`,
    value: source.body,
  });
  const { default: Content } = await evaluate(file, {
    ...runtime,
    rehypePlugins: [
      rehypeSlug,
      [rehypeHeadingAnchors, { label: en.blog.anchor }],
      [
        rehypeShiki,
        {
          defaultLanguage: "text",
          fallbackLanguage: "text",
          langs: languages,
          theme,
          transformers: [transformerNotationHighlight()],
        },
      ],
      rehypeToc,
    ],
    remarkPlugins: [remarkGfm],
    remarkRehypeOptions: {
      footnoteBackLabel: en.blog.footnoteBack,
      footnoteLabel: en.blog.footnotes,
      footnoteLabelProperties: { className: ["footnotes-heading"] },
    },
  });
  const components = {
    a: (props: ComponentPropsWithoutRef<"a">) => <BlogLink {...props} />,
    Chart: (props: ChartMdxProps) => <Chart {...props} slug={slug} />,
    Diagram: (props: DiagramMdxProps) => <Diagram {...props} />,
    Figure: ({ alt, caption, src }: FigureProps) => (
      <Figure
        alt={alt}
        caption={caption}
        priority={takeFirst()}
        slug={slug}
        src={src}
      />
    ),
    img: ({ alt = "", src = "" }: ImageProps) => (
      <BlogImage alt={alt} priority={takeFirst()} slug={slug} src={src} />
    ),
    Note: ({ children }: NoteProps) => <Note>{children}</Note>,
  };
  return {
    content: <Content components={components} />,
    toc: file.data.toc ?? [],
  };
};
