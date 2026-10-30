const selectedItem = (strip: HTMLElement): HTMLElement | null =>
  strip
    .querySelector(':checked, [aria-selected="true"]')
    ?.closest<HTMLElement>(".tab-strip-item") ?? null;

export const initTabStrip = (strip: HTMLElement): (() => void) => {
  let frame = 0;
  const place = (): void => {
    const item = selectedItem(strip);
    if (!item) return;
    strip.style.setProperty("--tab-x", `${String(item.offsetLeft)}px`);
    strip.style.setProperty("--tab-w", `${String(item.offsetWidth)}px`);
    const start = item.offsetLeft;
    const end = start + item.offsetWidth;
    if (start < strip.scrollLeft) strip.scrollLeft = start;
    else if (end > strip.scrollLeft + strip.clientWidth) {
      strip.scrollLeft = end - strip.clientWidth;
    }
    if (!Object.hasOwn(strip.dataset, "measured")) {
      frame = requestAnimationFrame(() => {
        strip.dataset["measured"] = "";
      });
    }
  };
  const observer = new ResizeObserver(place);
  observer.observe(strip);
  for (const item of strip.querySelectorAll(".tab-strip-item")) {
    observer.observe(item);
  }
  strip.addEventListener("change", place);
  place();
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    strip.removeEventListener("change", place);
  };
};
