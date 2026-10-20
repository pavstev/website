import type { ComponentPropsWithoutRef, ReactElement } from "react";

import { isExternalHref, leavesBlog } from "@/lib/blog/links";
import { en } from "@/lib/i18n";

type BlogLinkProps = ComponentPropsWithoutRef<"a">;

export const BlogLink = ({
  children,
  href = "",
  ...rest
}: BlogLinkProps): ReactElement =>
  isExternalHref(href) ? (
    <a {...rest} href={href} rel="noopener noreferrer" target="_blank">
      {children}
      <span className="sr-only"> {en.blog.newTab}</span>
    </a>
  ) : (
    <a
      {...rest}
      data-astro-reload={leavesBlog(href) ? "" : undefined}
      href={href}
    >
      {children}
    </a>
  );
