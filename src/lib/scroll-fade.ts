const hideAfter = 900;
const timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

const scroller = (target: EventTarget | null): HTMLElement | undefined => {
  if (target instanceof Document) return target.documentElement;
  return target instanceof HTMLElement ? target : undefined;
};

export const watchScrollFade = (): void => {
  document.addEventListener(
    "scroll",
    (event) => {
      const element = scroller(event.target);
      if (element === undefined) return;
      if (element.dataset["scrolled"] === undefined) {
        element.dataset["scrolled"] = "";
        getComputedStyle(element).getPropertyValue("scrollbar-color");
      }
      element.dataset["scrolling"] = "";
      globalThis.clearTimeout(timers.get(element));
      timers.set(
        element,
        globalThis.setTimeout(() => {
          delete element.dataset["scrolling"];
        }, hideAfter)
      );
    },
    { capture: true, passive: true }
  );
};
