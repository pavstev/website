import { playFlip, type Snapshot, snapshot } from "./flip.ts";
import { en } from "./i18n.ts";
import { initSelectMenu, type SelectMenu } from "./select-menu.ts";
import { initTabStrip } from "./tab-strip.ts";
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

const snapshotMs = 1000;

const groupsOf = (inputs: readonly HTMLInputElement[]): WorkGroup[] =>
  workGroups.filter((group) => inputs.some(({ value }) => value === group));

const readView = (
  inputs: readonly HTMLInputElement[],
  menu: SelectMenu | undefined
): WorkView =>
  toWorkView(
    inputs.find((input) => input.checked)?.value ?? null,
    menu?.value() ?? null,
    groupsOf(inputs)
  );

const shownCount = (
  cards: readonly HTMLElement[],
  filter: WorkFilter
): number =>
  filter === "all"
    ? cards.length
    : cards.filter((card) => card.dataset["group"] === filter).length;

const mount = (root: HTMLElement): (() => void) => {
  const grid = root.querySelector<HTMLElement>("[data-work-grid]");
  if (!grid) return () => undefined;
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
    menu?.set(view.sort);
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

  let before: Snapshot | undefined;
  let beforeAt = 0;
  const remember = (): void => {
    before = snapshot(cards);
    beforeAt = performance.now();
  };
  const change = (): void => {
    const fresh = before && performance.now() - beforeAt < snapshotMs;
    const from = fresh && before ? before : snapshot(cards);
    before = undefined;
    apply(readView(inputs, menu), true);
    playFlip(from);
  };

  const sortRoot = root.querySelector<HTMLElement>("[data-select-menu]");
  const menu = sortRoot
    ? initSelectMenu(sortRoot, () => {
        remember();
        change();
      })
    : undefined;
  apply(parseWorkView(location.search, groupsOf(inputs)), false);
  const strip = root.querySelector<HTMLElement>("[data-tab-strip]");
  const stopStrip = strip ? initTabStrip(strip) : undefined;
  const filter = root.querySelector<HTMLElement>(".work-filter");
  filter?.addEventListener("pointerdown", remember);
  filter?.addEventListener("keydown", remember);
  root.addEventListener("change", change);
  root.dataset["ready"] = "";
  return () => {
    menu?.dispose();
    stopStrip?.();
  };
};

let mounted: HTMLElement | null = null;
let unmount: (() => void) | undefined;

const release = (): void => {
  unmount?.();
  unmount = undefined;
  mounted = null;
};

const sync = (): void => {
  const root = document.querySelector<HTMLElement>("[data-work]");
  if (!root || root === mounted) return;
  release();
  mounted = root;
  unmount = mount(root);
};

export const watchWorkControls = (): void => {
  sync();
  document.addEventListener("astro:page-load", sync);
  document.addEventListener("astro:before-swap", release);
};
