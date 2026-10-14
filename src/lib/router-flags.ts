interface PageFlag {
  name: string;
  value: string;
}

const isPageFlag = (name: string): boolean =>
  name.startsWith("data-") && !name.startsWith("data-astro-");

export const carriedFlags = (attributes: Iterable<PageFlag>): PageFlag[] =>
  [...attributes].filter(({ name }) => isPageFlag(name));

export const keepPageFlags = (): void => {
  document.addEventListener("astro:before-swap", (event) => {
    const incoming = event.newDocument.documentElement;
    for (const { name, value } of carriedFlags(
      document.documentElement.attributes
    ))
      incoming.setAttribute(name, value);
  });
};
