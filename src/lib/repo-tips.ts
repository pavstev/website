import { placeTip } from "./tip-place.ts";

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

const placeRepoTip = (key: HTMLElement): void => {
  const anchor = key.querySelector<HTMLElement>(".tip-anchor");
  const tip = anchor?.querySelector<HTMLElement>(".tip");
  if (!anchor || !tip) return;
  const { clientHeight, clientWidth } = document.documentElement;
  const placement = placeTip({
    align: "center",
    anchor: key.getBoundingClientRect(),
    avoid: [],
    height: tip.offsetHeight,
    side: "top",
    viewport: { height: clientHeight, width: clientWidth },
    width: tip.offsetWidth,
  });
  anchor.dataset["side"] = placement.side;
  anchor.style.setProperty("--tip-gap", `${String(placement.gap)}px`);
  anchor.style.translate =
    placement.shift === 0 ? "" : `${String(placement.shift)}px 0`;
};

const placeFrom = (event: Event): void => {
  const key = keyOf(event.target);
  if (key) placeRepoTip(key);
};

export const watchRepoTips = (): void => {
  document.addEventListener("pointerover", placeFrom, { capture: true });
  document.addEventListener("focusin", placeFrom, { capture: true });
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
