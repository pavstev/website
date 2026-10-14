import type { ReactElement } from "react";

import { BlogSide } from "@/components/blog/blog-side";
import { PostToc } from "@/components/blog/post-toc";
import { TocSpy } from "@/components/blog/toc-spy";
import { type TocItem } from "@/lib/blog/toc";

interface PostBodyProps {
  content: ReactElement;
  toc: readonly TocItem[];
}

export const PostBody = ({ content, toc }: PostBodyProps): ReactElement => (
  <div className="post-layout">
    <BlogSide />
    <PostToc items={toc} />
    <article className="prose-blog">{content}</article>
    {toc.length > 0 && <TocSpy />}
  </div>
);
