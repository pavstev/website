const shown = ":hover, :has(:focus-visible)";

interface Key {
  dataset: Record<string, string | undefined>;
  matches: (selector: string) => boolean;
}

export const dismissRepoTips = (keys: Iterable<Key>): void => {
  for (const key of keys) {
    if (key.matches(shown)) key.dataset["dismissed"] = "";
  }
};

export const restoreRepoTip = (key: null | Pick<Key, "dataset">): void => {
  if (key) delete key.dataset["dismissed"];
};

const keyOf = (target: EventTarget | null): HTMLElement | null =>
  target instanceof Element
    ? target.closest<HTMLElement>("[data-repo-key]")
    : null;

export const watchRepoTips = (): void => {
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    dismissRepoTips(document.querySelectorAll<HTMLElement>("[data-repo-key]"));
  });
  document.addEventListener(
    "pointerleave",
    (event) => {
      const key = keyOf(event.target);
      if (key?.matches(":has(:focus-visible)") === false) restoreRepoTip(key);
    },
    { capture: true }
  );
  document.addEventListener(
    "focusout",
    (event) => {
      restoreRepoTip(keyOf(event.target));
    },
    { capture: true }
  );
};
