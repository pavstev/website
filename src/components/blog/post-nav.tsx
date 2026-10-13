import type { ReactElement } from "react";

import Link from "next/link";

import { Icon } from "@/components/icon";
import { type PostMeta } from "@/lib/blog/schema";
import { en } from "@/lib/i18n";

interface PostNavProps {
  newer?: PostMeta | undefined;
  older?: PostMeta | undefined;
}

export const PostNav = ({ newer, older }: PostNavProps): ReactElement => (
  <nav aria-label={en.blog.postNav} className="post-nav">
    {older === undefined ? (
      <span className="post-nav-gap" />
    ) : (
      <Link
        className="post-nav-link post-nav-prev focus-ring"
        href={`/blog/${older.slug}`}
        prefetch={false}
        rel="prev"
      >
        <Icon name="lucide:arrow-left" size="0.875rem" />
        <span className="sr-only">{en.blog.previous}: </span>
        <span className="post-nav-title">{older.title}</span>
      </Link>
    )}
    <Link
      className="post-nav-all contact-link focus-ring"
      href="/blog"
      prefetch={false}
    >
      <Icon name="lucide:layout-grid" size="0.875rem" />
      {en.blog.back}
    </Link>
    {newer === undefined ? (
      <span className="post-nav-gap" />
    ) : (
      <Link
        className="post-nav-link post-nav-next focus-ring"
        href={`/blog/${newer.slug}`}
        prefetch={false}
        rel="next"
      >
        <span className="sr-only">{en.blog.next}: </span>
        <span className="post-nav-title">{newer.title}</span>
        <Icon name="lucide:arrow-right" size="0.875rem" />
      </Link>
    )}
  </nav>
);
