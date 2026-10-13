import type { ReactElement, ReactNode } from "react";

import { en } from "@/lib/i18n";
import { personalData } from "@/lib/personal";

interface SiteFooterProps {
  children?: ReactNode;
  className: string;
  rss?: boolean;
}

export const SiteFooter = ({
  children,
  className,
  rss = false,
}: SiteFooterProps): ReactElement => {
  const year = new Date().getFullYear();
  return (
    <div className={`${className} type-chip`}>
      <p className="tabular text-sky">
        © {year} <span className="whitespace-nowrap">{personalData.name}</span>
        {rss && (
          <>
            <span aria-hidden="true"> · </span>
            <a
              className="focus-ring"
              href="/blog/feed.xml"
              type="application/rss+xml"
            >
              {en.blog.rss}
            </a>
          </>
        )}
        {children ? (
          <>
            <br />
            {children}
          </>
        ) : null}
      </p>
    </div>
  );
};
