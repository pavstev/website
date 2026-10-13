import type { ReactElement } from "react";

import { en } from "@/lib/i18n";

interface PostTagsProps {
  className?: string;
  tags: readonly string[];
  unlabeled?: boolean;
}

export const PostTags = ({
  className = "",
  tags,
  unlabeled = false,
}: PostTagsProps): ReactElement => (
  <ul
    aria-label={unlabeled ? undefined : en.blog.tags}
    className={`post-tags ${className}`.trim()}
  >
    {tags.map((tag) => (
      <li className="post-tag type-chip" key={tag}>
        {tag}
      </li>
    ))}
  </ul>
);
