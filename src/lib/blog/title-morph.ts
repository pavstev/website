import { isBlogPage, postSlug } from "./slug.ts";

interface MorphPlan {
  from: TitleKind;
  slug: string;
  to: TitleKind;
}

type TitleKind = "post" | "row";

const nameProperty = "view-transition-name";

export const morphPlan = (
  fromPath: string,
  toPath: string
): MorphPlan | undefined => {
  if (!isBlogPage(fromPath) || !isBlogPage(toPath)) return undefined;
  const from = postSlug(fromPath);
  const to = postSlug(toPath);
  if (from === undefined && to !== undefined)
    return { from: "row", slug: to, to: "post" };
  return from !== undefined && to === undefined
    ? { from: "post", slug: from, to: "row" }
    : undefined;
};

const titleOf = (
  root: ParentNode,
  kind: TitleKind,
  slug: string
): HTMLElement | null =>
  root.querySelector<HTMLElement>(
    kind === "row"
      ? `[data-post-slug="${CSS.escape(slug)}"] .post-row-title`
      : ".blog-title"
  );

const mark = (root: ParentNode, kind: TitleKind, slug: string): void => {
  titleOf(root, kind, slug)?.style.setProperty(nameProperty, `title-${slug}`);
};

const clearMarks = (): void => {
  for (const element of document.querySelectorAll<HTMLElement>(
    "[style*='view-transition-name']"
  ))
    element.style.removeProperty(nameProperty);
};

export const morphTitles = (): void => {
  document.addEventListener("astro:before-preparation", (event) => {
    clearMarks();
    const plan = morphPlan(event.from.pathname, event.to.pathname);
    if (plan) mark(document, plan.from, plan.slug);
  });
  document.addEventListener("astro:before-swap", (event) => {
    const plan = morphPlan(event.from.pathname, event.to.pathname);
    if (!plan) return;
    mark(event.newDocument, plan.to, plan.slug);
    void event.viewTransition.finished.then(clearMarks).catch(clearMarks);
  });
};
