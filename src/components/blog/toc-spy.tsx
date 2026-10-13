"use client";

import { useEffect } from "react";

import { currentSection, tocLine } from "@/lib/blog/toc";

const headingSelector = ".prose-blog h2[id], .prose-blog h3[id]";
const linkSelector = ".post-toc a[href^='#']";

const mark = (links: HTMLAnchorElement[], id: string | undefined): void => {
  for (const link of links) {
    link.removeAttribute("aria-current");
  }
  if (id !== undefined) {
    for (const link of links) {
      if (link.getAttribute("href") === `#${id}`) {
        link.setAttribute("aria-current", "location");
      }
    }
  }
};

export const TocSpy = (): null => {
  useEffect(() => {
    const headings = [...document.querySelectorAll(headingSelector)];
    const links = [
      ...document.querySelectorAll<HTMLAnchorElement>(linkSelector),
    ];
    if (headings.length === 0 || links.length === 0) {
      return;
    }
    let current = currentSection(
      headings.map((heading) => heading.getBoundingClientRect().top),
      window.innerHeight * tocLine
    );
    mark(links, headings[current]?.id);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = headings.indexOf(entry.target);
          const top = entry.rootBounds?.top ?? 0;
          if (entry.isIntersecting) {
            current = index;
          } else if (entry.boundingClientRect.top > top && index <= current) {
            current = index - 1;
          }
        }
        mark(links, headings[current]?.id);
      },
      { rootMargin: `0px 0px -${String((1 - tocLine) * 100)}% 0px` }
    );
    for (const heading of headings) {
      observer.observe(heading);
    }
    return (): void => {
      observer.disconnect();
    };
  }, []);
  return null;
};
