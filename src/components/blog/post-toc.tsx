import type { ReactElement } from "react";

import { type TocItem } from "@/lib/blog/toc";
import { en } from "@/lib/i18n";

interface PostTocProps {
  items: readonly TocItem[];
}

const tocList = (items: readonly TocItem[]): ReactElement => (
  <ol className="toc-list">
    {items.map((item) => (
      <li className="toc-item" data-depth={item.depth} key={item.id}>
        <a className="toc-link focus-ring" href={`#${item.id}`}>
          {item.text}
        </a>
      </li>
    ))}
  </ol>
);

export const PostToc = ({ items }: PostTocProps): null | ReactElement =>
  items.length === 0 ? null : (
    <nav aria-label={en.blog.toc} className="post-toc">
      <details className="toc-details">
        <summary className="toc-summary focus-ring">{en.blog.toc}</summary>
        {tocList(items)}
      </details>
      <div className="toc-aside">
        <p aria-hidden="true" className="toc-title type-chip">
          {en.blog.toc}
        </p>
        {tocList(items)}
      </div>
    </nav>
  );
