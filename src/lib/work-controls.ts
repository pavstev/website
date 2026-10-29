import { en } from "./i18n.ts";
import { fillText } from "./template.ts";
import {
  parseWorkView,
  sortWork,
  toWorkView,
  type WorkFilter,
  type WorkGroup,
  workGroups,
  workSortKeys,
  type WorkView,
  workViewSearch,
} from "./work.ts";

const groupsOf = (inputs: readonly HTMLInputElement[]): WorkGroup[] =>
  workGroups.filter((group) => inputs.some(({ value }) => value === group));

const readView = (
  inputs: readonly HTMLInputElement[],
  select: HTMLSelectElement | null
): WorkView =>
  toWorkView(
    inputs.find((input) => input.checked)?.value ?? null,
    select?.value ?? null,
    groupsOf(inputs)
  );

const shownCount = (
  cards: readonly HTMLElement[],
  filter: WorkFilter
): number =>
  filter === "all"
    ? cards.length
    : cards.filter((card) => card.dataset["group"] === filter).length;

const mount = (root: HTMLElement): void => {
  const grid = root.querySelector<HTMLElement>("[data-work-grid]");
  if (!grid) return;
  const select = root.querySelector<HTMLSelectElement>("#work-sort");
  const status = root.querySelector<HTMLElement>("[data-work-status]");
  const inputs = [
    ...root.querySelectorAll<HTMLInputElement>('input[name="work-show"]'),
  ];
  const cards = [...grid.children].filter(
    (child): child is HTMLElement => child instanceof HTMLElement
  );
  const keyed = cards.map((card) => ({
    card,
    ...workSortKeys(card.dataset),
  }));

  const apply = (view: WorkView, announce: boolean): void => {
    for (const input of inputs) input.checked = input.value === view.filter;
    if (select) select.value = view.sort;
    grid.append(...sortWork(keyed, view.sort).map(({ card }) => card));
    const search = workViewSearch(view, location.search);
    if (search !== location.search) {
      history.replaceState(
        history.state,
        "",
        `${location.pathname}${search}${location.hash}`
      );
    }
    if (announce && status) {
      status.textContent = fillText(en.work.status, {
        shown: String(shownCount(cards, view.filter)),
        total: String(cards.length),
      });
    }
  };

  apply(parseWorkView(location.search, groupsOf(inputs)), false);
  root.addEventListener("change", () => {
    apply(readView(inputs, select), true);
  });
  root.dataset["ready"] = "";
};

let mounted: HTMLElement | null = null;

const sync = (): void => {
  const root = document.querySelector<HTMLElement>("[data-work]");
  if (!root || root === mounted) return;
  mounted = root;
  mount(root);
};

export const watchWorkControls = (): void => {
  sync();
  document.addEventListener("astro:page-load", sync);
};
