import { type ReactElement, useEffect } from "react";

import { ScrollSpyThumb, useScrollSpy } from "@/components/ui/scroll-spy";

const headingSelector = ".prose-blog h2[id], .prose-blog h3[id]";
const linkSelector = ".post-toc a[href^='#']";

const pixels = (value: string): number => {
  const parsed = Number(value.replace(/px$/u, ""));
  return Number.isNaN(parsed) ? 0 : parsed;
};

const tocOffset = (): number => {
  const heading = document.querySelector(headingSelector);
  return (
    pixels(getComputedStyle(document.documentElement).scrollPaddingTop) +
    (heading ? pixels(getComputedStyle(heading).scrollMarginTop) : 0)
  );
};

export const TocSpy = (): ReactElement => {
  const activeId = useScrollSpy({
    headings: headingSelector,
    links: linkSelector,
    offset: tocOffset,
  });

  useEffect(() => {
    for (const link of document.querySelectorAll<HTMLAnchorElement>(
      linkSelector
    )) {
      link.ariaCurrent =
        activeId !== undefined && link.getAttribute("href") === `#${activeId}`
          ? "location"
          : null;
    }
  }, [activeId]);

  return (
    <ScrollSpyThumb
      activeId={activeId}
      className="toc-thumb"
      container=".toc-aside"
    />
  );
};
