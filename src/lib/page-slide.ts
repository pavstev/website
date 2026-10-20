import { isBlogPage } from "./blog/slug.ts";

export type SlideFrom = "left" | "right";

const clean = (pathname: string): string => {
  const trimmed = pathname.replace(/\.html$/u, "").replace(/\/+$/u, "");
  return trimmed === "" ? "/" : trimmed;
};

export const slideSection = (pathname: string): number | undefined => {
  const path = clean(pathname);
  if (path === "/about") return 0;
  if (path === "/work") return 1;
  return isBlogPage(path) ? 2 : undefined;
};

export const slideFrom = (
  fromPath: string,
  toPath: string,
  direction: string
): SlideFrom | undefined => {
  const from = slideSection(fromPath);
  const to = slideSection(toPath);
  if (from === undefined || to === undefined) return undefined;
  if (from === to) return direction === "back" ? "left" : "right";
  return to > from ? "right" : "left";
};

const flag = "data-slide";

export const watchPageSlide = (): void => {
  const root = document.documentElement;
  const clear = (): void => {
    root.removeAttribute(flag);
  };
  document.addEventListener("astro:before-preparation", (event) => {
    const side = slideFrom(
      event.from.pathname,
      event.to.pathname,
      event.direction
    );
    if (side === undefined) clear();
    else root.setAttribute(flag, side);
  });
  document.addEventListener("astro:before-swap", (event) => {
    void event.viewTransition.finished.then(clear).catch(clear);
  });
};
