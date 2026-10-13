import type { ReactElement } from "react";

import Link from "next/link";

import { type TagEntry, tagHref } from "@/lib/blog/tags";
import { en } from "@/lib/i18n";

interface TagRowProps {
  current?: string | undefined;
  tags: readonly TagEntry[];
}

const countLabel = (tag: TagEntry): string =>
  (tag.count === 1 ? en.blog.tagCountOne : en.blog.tagCount)
    .replace("{tag}", () => tag.name)
    .replace("{n}", () => String(tag.count));

export const TagRow = ({ current, tags }: TagRowProps): null | ReactElement =>
  tags.length === 0 ? null : (
    <ul aria-label={en.blog.tags} className="blog-tags">
      {tags.map((tag) => (
        <li className="post-tag type-chip" key={tag.slug}>
          <Link
            aria-current={tag.slug === current ? "page" : undefined}
            aria-label={countLabel(tag)}
            className="post-tag-link blog-tag-link focus-ring"
            href={tagHref(tag.name)}
            prefetch={false}
          >
            {tag.name}
            <span aria-hidden="true" className="blog-tag-count tabular">
              {tag.count}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
