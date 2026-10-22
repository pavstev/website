import { initAnchoredPopovers } from "./anchored-popovers.ts";
import { fillCount } from "./template.ts";

const idle = (): void => undefined;

const shownCount = (list: HTMLElement, items: HTMLElement[]): number => {
  const edge = list.getBoundingClientRect().right + 0.5;
  const index = items.findIndex(
    (item) => item.getBoundingClientRect().right > edge
  );
  return index === -1 ? items.length : index;
};

const fadeFrom = (list: HTMLElement, item: HTMLElement | undefined): string =>
  item
    ? `${String(Math.round(item.getBoundingClientRect().left - list.getBoundingClientRect().left))}px`
    : "100%";

const markShown = (
  items: HTMLElement[],
  rest: HTMLElement[],
  shown: number
): void => {
  for (const [index, item] of items.entries()) {
    item.ariaHidden = index < shown ? null : "true";
  }
  for (const [index, item] of rest.entries()) item.hidden = index < shown;
};

const fitLane = (lane: HTMLElement): void => {
  const list = lane.querySelector<HTMLElement>(":scope > .tech-tags");
  const more = lane.querySelector<HTMLButtonElement>(":scope > .tech-more");
  const panel = lane.querySelector<HTMLElement>(":scope > .tech-pop");
  if (!list || !more || !panel) return;
  const items = [...list.querySelectorAll<HTMLElement>(":scope > li")];
  const rest = [...panel.querySelectorAll<HTMLElement>("li")];
  delete lane.dataset["overflow"];
  lane.style.removeProperty("--lane-fade");
  more.hidden = true;
  if (list.scrollWidth <= list.clientWidth) {
    if (panel.matches(":popover-open")) panel.hidePopover();
    markShown(items, rest, items.length);
    return;
  }
  lane.dataset["overflow"] = "";
  more.hidden = false;
  const label = (shown: number): void => {
    more.textContent = fillCount(
      more.dataset["more"] ?? "",
      items.length - shown
    );
  };
  label(shownCount(list, items));
  const shown = shownCount(list, items);
  label(shown);
  more.setAttribute(
    "aria-label",
    fillCount(more.dataset["moreLabel"] ?? "", items.length - shown)
  );
  lane.style.setProperty("--lane-fade", fadeFrom(list, items[shown]));
  markShown(items, rest, shown);
};

const initTechLanes = (lanes: HTMLElement[]): (() => void) => {
  const observer = new ResizeObserver((entries) => {
    const touched = new Set(
      entries.flatMap(
        ({ target }) => target.closest<HTMLElement>("[data-tech-lane]") ?? []
      )
    );
    for (const lane of touched) fitLane(lane);
  });
  for (const lane of lanes) {
    lane.dataset["fit"] = "";
    observer.observe(lane);
    for (const item of lane.querySelectorAll(":scope > .tech-tags > li")) {
      observer.observe(item);
    }
  }
  void document.fonts.ready.then(() => {
    for (const lane of lanes) fitLane(lane);
  });
  const unbind = lanes.map((lane) => initAnchoredPopovers(lane));
  return () => {
    observer.disconnect();
    for (const dispose of unbind) dispose();
  };
};

export const watchTechLanes = (): void => {
  let stop = idle;
  const start = (): void => {
    stop();
    const lanes = [
      ...document.querySelectorAll<HTMLElement>("[data-tech-lane]"),
    ];
    stop = lanes.length > 0 ? initTechLanes(lanes) : idle;
  };
  start();
  document.addEventListener("astro:after-swap", start);
  document.addEventListener("astro:before-swap", () => {
    stop();
    stop = idle;
  });
};
