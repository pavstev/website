import { fillCount } from "./template.ts";

const overflows = (row: HTMLElement): boolean =>
  row.scrollWidth > row.clientWidth + 1;

const label = (button: HTMLElement, hidden: number): void => {
  button.textContent = fillCount(button.dataset["text"] ?? "", hidden);
  button.setAttribute(
    "aria-label",
    fillCount(button.dataset["label"] ?? "", hidden)
  );
};

const fit = (row: HTMLElement, button: HTMLElement): void => {
  const chips = row.querySelectorAll<HTMLElement>(":scope > .repo-chip");
  delete row.dataset["squeeze"];
  for (const chip of chips) chip.hidden = false;
  button.hidden = true;
  let hidden = 0;
  if (overflows(row)) {
    button.hidden = false;
    for (let index = chips.length - 1; index >= 1; index -= 1) {
      label(button, hidden + 1);
      if (!overflows(row)) break;
      const chip = chips[index];
      if (chip) chip.hidden = true;
      hidden += 1;
    }
    label(button, hidden);
    if (overflows(row)) row.dataset["squeeze"] = "";
  }
  button.hidden = hidden === 0;
};

export const initTagFit = (root: ParentNode): (() => void) => {
  const pairs = root
    .querySelectorAll<HTMLElement>(".repo-tags")
    .values()
    .map((tags) => ({
      button: tags.querySelector<HTMLElement>(":scope > .repo-more"),
      row: tags.querySelector<HTMLElement>(":scope > .repo-tags-row"),
    }))
    .toArray();
  const run = (): void => {
    for (const { button, row } of pairs) {
      if (button && row) fit(row, button);
    }
  };
  const observer = new ResizeObserver(run);
  for (const { row } of pairs) {
    if (row?.parentElement) observer.observe(row.parentElement);
  }
  void document.fonts.ready.then(run);
  run();
  return () => {
    observer.disconnect();
  };
};
