import type { ReactElement } from "react";

import { TocDrawer } from "@/components/blog/toc-drawer";
import { Icon } from "@/components/icon";
import { branchOf, type TocItem } from "@/lib/blog/toc";
import { en } from "@/lib/i18n";

interface PostTocProps {
  items: readonly TocItem[];
}

const tocList = (items: readonly TocItem[]): ReactElement => (
  <ol className="toc-list">
    {items.map((item, index) => (
      <li
        className="toc-item"
        data-branch={branchOf(items, index)}
        data-depth={item.depth}
        key={item.id}
      >
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
      <button
        aria-controls="toc-drawer"
        aria-haspopup="dialog"
        className="toc-open focus-ring"
        data-toc-open=""
        type="button"
      >
        <Icon name="lucide:list" size="1rem" />
        {en.blog.toc}
      </button>
      <div className="toc-aside">
        <p aria-hidden="true" className="toc-title type-chip">
          {en.blog.toc}
        </p>
        {tocList(items)}
      </div>
      <TocDrawer items={items} />
    </nav>
  );
