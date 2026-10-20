import type { Blocker } from "@/lib/tip-place";

export const contactAvoid = (): Blocker[] => [
  ...[
    ...document.querySelectorAll(
      ".contact-row :is(.download-pill, .contact-link)"
    ),
  ].map((element) => ({ box: element.getBoundingClientRect(), weight: 2 })),
  ...[...document.querySelectorAll(".section-link")].map((element) => ({
    box: element.getBoundingClientRect(),
    weight: 1,
  })),
  ...[...document.querySelectorAll("[data-card] > [data-blur-in]")].map(
    (element) => ({ box: element.getBoundingClientRect(), weight: 3 })
  ),
];
