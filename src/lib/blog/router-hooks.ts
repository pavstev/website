import { postSlug } from "./slug.ts";

const nameProperty = "view-transition-name";

const rowTitle = (root: ParentNode, slug: string): HTMLElement | null =>
  root.querySelector<HTMLElement>(
    `[data-post-slug="${CSS.escape(slug)}"] .post-row-title`
  );

const postTitle = (root: ParentNode): HTMLElement | null =>
  root.querySelector<HTMLElement>(".blog-title");

const mark = (element: HTMLElement | null, slug: string): void => {
  element?.style.setProperty(nameProperty, `title-${slug}`);
};

const clearMarks = (): void => {
  for (const element of document.querySelectorAll<HTMLElement>(
    "[style*='view-transition-name']"
  ))
    element.style.removeProperty(nameProperty);
};

document.addEventListener("astro:before-preparation", (event) => {
  clearMarks();
  const from = postSlug(event.from.pathname);
  const to = postSlug(event.to.pathname);
  if (from === undefined && to !== undefined) mark(rowTitle(document, to), to);
  if (from !== undefined && to === undefined) mark(postTitle(document), from);
});

document.addEventListener("astro:before-swap", (event) => {
  const root = event.newDocument.documentElement;
  for (const { name, value } of document.documentElement.attributes)
    if (name.startsWith("data-") && !name.startsWith("data-astro-"))
      root.setAttribute(name, value);
  const from = postSlug(event.from.pathname);
  const to = postSlug(event.to.pathname);
  if (from === undefined && to !== undefined)
    mark(postTitle(event.newDocument), to);
  if (from !== undefined && to === undefined)
    mark(rowTitle(event.newDocument, from), from);
});
