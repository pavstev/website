const hasScrollTimeline = (): boolean =>
  typeof CSS !== "undefined" && CSS.supports("animation-timeline: view()");

export const progressWriter = (
  root: ParentNode,
  supported: boolean = hasScrollTimeline()
): ((value: number) => void) => {
  const bar = root.querySelector<HTMLElement>("[data-scroll-progress]");
  if (!bar || supported) return () => undefined;
  let shown = -1;
  return (value): void => {
    const next = Math.round(Math.min(1, Math.max(0, value)) * 1000) / 1000;
    if (next === shown) return;
    shown = next;
    bar.style.setProperty("--story-progress", String(next));
  };
};
