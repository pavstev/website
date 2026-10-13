import type { ReactElement } from "react";

import Link from "next/link";

import { pageHref } from "@/lib/blog/pagination";
import { en } from "@/lib/i18n";

interface PaginationProps {
  base: string;
  count: number;
  page: number;
}

const pageLabel = (page: number): string =>
  en.blog.page.replace("{n}", () => String(page));

export const Pagination = ({
  base,
  count,
  page,
}: PaginationProps): null | ReactElement => {
  if (count <= 1) return null;
  const pages = Array.from({ length: count }, (_, index) => index + 1);
  return (
    <nav aria-label={en.blog.pagination} className="blog-pagination">
      {page > 1 && (
        <Link
          className="focus-ring"
          href={pageHref(base, page - 1)}
          prefetch={false}
          rel="prev"
        >
          {en.blog.previousPage}
        </Link>
      )}
      {pages.map((number) =>
        number === page ? (
          <span aria-current="page" key={number}>
            <span className="sr-only">{pageLabel(number)}</span>
            <span aria-hidden="true">{number}</span>
          </span>
        ) : (
          <Link
            aria-label={pageLabel(number)}
            className="focus-ring"
            href={pageHref(base, number)}
            key={number}
            prefetch={false}
          >
            {number}
          </Link>
        )
      )}
      {page < count && (
        <Link
          className="focus-ring"
          href={pageHref(base, page + 1)}
          prefetch={false}
          rel="next"
        >
          {en.blog.nextPage}
        </Link>
      )}
    </nav>
  );
};
