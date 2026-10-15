import type { Blocker } from "@/lib/tip-place";

import { initPressDepth } from "@/lib/press-depth";

export const contactAvoid = (): Blocker[] => [
  ...[
    ...document.querySelectorAll(
      ".contact-row :is(.download-pill, .contact-link)"
    ),
  ].map((element) => ({ box: element.getBoundingClientRect(), weight: 2 })),
  ...[
    ...document.querySelectorAll("[data-card] > [data-blur-in], .section-link"),
  ].map((element) => ({ box: element.getBoundingClientRect(), weight: 1 })),
];

export const initContactLinks = (list: HTMLElement): (() => void) => {
  const scope =
    list.closest<HTMLElement>("[data-card]") ??
    list.closest<HTMLElement>("[data-proximity]") ??
    list;
  return initPressDepth(scope, ".keycap-host");
};
