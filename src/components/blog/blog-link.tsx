import type { ComponentPropsWithoutRef, ReactElement } from "react";

import { isExternalHref } from "@/lib/blog/links";
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
    <a {...rest} href={href}>
      {children}
    </a>
  );
