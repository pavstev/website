import type { ReactElement } from "react";

import Link from "next/link";

import { Icon } from "@/components/icon";
import { en } from "@/lib/i18n";

interface BlogButtonProps {
  count: number;
}

export const BlogButton = ({ count }: BlogButtonProps): ReactElement => {
  const detail = (
    count === 1 ? en.card.blogDetailOne : en.card.blogDetailOther
  ).replace("{n}", () => String(count));
  return (
    <div className="contact-item" data-tone="gold">
      <Link
        aria-describedby="blog-detail"
        aria-label={en.card.blog}
        className="contact-link focus-ring inline-flex size-11 items-center justify-center rounded-lg"
        href="/blog"
        prefetch={false}
      >
        <span aria-hidden="true" className="contact-icon">
          <Icon name="lucide:notebook-pen" size="1.1em" />
        </span>
      </Link>
      <span className="contact-tip" id="blog-tip" role="tooltip">
        <span className="contact-tip-name">{en.card.blog}</span>{" "}
        <span className="contact-tip-detail" id="blog-detail">
          {detail}
        </span>
      </span>
    </div>
  );
};
