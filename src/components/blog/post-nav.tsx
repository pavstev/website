import type { ReactElement } from "react";

import Link from "next/link";

import { type PostMeta } from "@/lib/blog/schema";
import { en } from "@/lib/i18n";

interface PostNavProps {
  newer?: PostMeta | undefined;
  older?: PostMeta | undefined;
}

export const PostNav = ({ newer, older }: PostNavProps): ReactElement => (
  <nav aria-label={en.blog.postNav} className="post-nav">
    {(older !== undefined || newer !== undefined) && (
      <div className="post-nav-cards">
        {older !== undefined && (
          <Link
            className="post-nav-link focus-ring"
            href={`/blog/${older.slug}`}
            prefetch={false}
            rel="prev"
          >
            <span className="post-nav-label type-chip">{en.blog.previous}</span>
            <span className="post-nav-title">{older.title}</span>
          </Link>
        )}
        {newer !== undefined && (
          <Link
            className="post-nav-link post-nav-next focus-ring"
            href={`/blog/${newer.slug}`}
            prefetch={false}
            rel="next"
          >
            <span className="post-nav-label type-chip">{en.blog.next}</span>
            <span className="post-nav-title">{newer.title}</span>
          </Link>
        )}
      </div>
    )}
    <Link className="post-nav-back focus-ring" href="/blog" prefetch={false}>
      {en.blog.back}
    </Link>
  </nav>
);
