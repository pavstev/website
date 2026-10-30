import { initAnchoredPopovers } from "./anchored-popovers.ts";

export interface SelectMenu {
  dispose: () => void;
  set: (value: string) => void;
  value: () => string;
}

const typeaheadMs = 600;

export const stepIndex = (from: number, step: number, size: number): number =>
  size === 0 ? -1 : (((from + step) % size) + size) % size;

export const matchIndex = (
  labels: readonly string[],
  query: string,
  from: number
): number => {
  const text = query.toLowerCase();
  const start = text.length > 1 ? from : from + 1;
  for (let offset = 0; offset < labels.length; offset += 1) {
    const index = stepIndex(start, offset, labels.length);
    if (labels[index]?.toLowerCase().startsWith(text)) return index;
  }
  return -1;
};

export const initSelectMenu = (
  root: HTMLElement,
  onChange: (value: string) => void
): SelectMenu | undefined => {
  const trigger = root.querySelector<HTMLButtonElement>(".select-menu-trigger");
  const panel = root.querySelector<HTMLElement>(".select-menu-panel");
  const list = root.querySelector<HTMLElement>('[role="listbox"]');
  const shown = root.querySelector<HTMLElement>(".select-menu-value");
  if (!trigger || !panel || !list || !shown) return undefined;
  const options = [...list.querySelectorAll<HTMLElement>('[role="option"]')];
  const values = options.map((option) => option.dataset["value"] ?? "");
  const labels = options.map((option) => option.textContent.trim());
  let active = -1;
  let typed = "";
  let typedAt = 0;

  const selected = (): number =>
    Math.max(0, values.indexOf(root.dataset["value"] ?? ""));

  const activate = (index: number, reveal: boolean): void => {
    active = index;
    for (const [at, option] of options.entries()) {
      option.toggleAttribute("data-active", at === index);
    }
    const option = options[index];
    if (option) {
      list.setAttribute("aria-activedescendant", option.id);
      panel.style.setProperty("--select-y", `${String(option.offsetTop)}px`);
      panel.style.setProperty("--select-h", `${String(option.offsetHeight)}px`);
      if (reveal) option.scrollIntoView({ block: "nearest" });
    } else {
      list.removeAttribute("aria-activedescendant");
    }
  };

  const show = (value: string): void => {
    const index = values.indexOf(value);
    if (index === -1) return;
    root.dataset["value"] = value;
    root.toggleAttribute("data-changed", value !== root.dataset["default"]);
    shown.textContent = labels[index] ?? "";
    for (const [at, option] of options.entries()) {
      option.setAttribute("aria-selected", String(at === index));
    }
  };

  const choose = (index: number): void => {
    const value = values[index];
    if (value === undefined) return;
    const changed = value !== root.dataset["value"];
    show(value);
    panel.hidePopover();
    if (changed) onChange(value);
  };

  const onKey = (event: KeyboardEvent): void => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const moves: Record<string, number> = {
      ArrowDown: stepIndex(active, 1, options.length),
      ArrowUp: stepIndex(active, -1, options.length),
      End: options.length - 1,
      Home: 0,
    };
    const move = moves[event.key];
    if (move !== undefined) {
      event.preventDefault();
      activate(move, true);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Tab") {
      event.preventDefault();
      panel.hidePopover();
    } else if (event.key.length === 1) {
      const now = performance.now();
      typed = now - typedAt > typeaheadMs ? event.key : typed + event.key;
      typedAt = now;
      const index = matchIndex(labels, typed, active);
      if (index !== -1) activate(index, true);
    }
  };

  const onBeforeToggle = (event: Event): void => {
    if ((event as ToggleEvent).newState === "open") activate(selected(), false);
  };

  const onToggle = (event: Event): void => {
    if ((event as ToggleEvent).newState === "open") {
      activate(active, false);
      return;
    }
    activate(-1, false);
    typed = "";
  };

  const openKeys = new Set([" ", "ArrowDown", "ArrowUp", "Enter"]);

  const onTriggerKey = (event: KeyboardEvent): void => {
    if (!openKeys.has(event.key) || panel.matches(":popover-open")) return;
    event.preventDefault();
    panel.showPopover();
    list.focus({ preventScroll: true });
  };

  const onMove = (event: PointerEvent): void => {
    const option = (event.target as Element).closest<HTMLElement>(
      '[role="option"]'
    );
    const index = option ? options.indexOf(option) : -1;
    if (index !== -1 && index !== active) activate(index, false);
  };

  const onClick = (event: MouseEvent): void => {
    const option = (event.target as Element).closest<HTMLElement>(
      '[role="option"]'
    );
    const index = option ? options.indexOf(option) : -1;
    if (index !== -1) choose(index);
  };

  const stopPopovers = initAnchoredPopovers(root);
  list.addEventListener("keydown", onKey);
  list.addEventListener("pointermove", onMove);
  list.addEventListener("click", onClick);
  panel.addEventListener("beforetoggle", onBeforeToggle);
  panel.addEventListener("toggle", onToggle);
  trigger.addEventListener("keydown", onTriggerKey);

  return {
    dispose: () => {
      stopPopovers();
      list.removeEventListener("keydown", onKey);
      list.removeEventListener("pointermove", onMove);
      list.removeEventListener("click", onClick);
      panel.removeEventListener("beforetoggle", onBeforeToggle);
      panel.removeEventListener("toggle", onToggle);
      trigger.removeEventListener("keydown", onTriggerKey);
    },
    set: show,
    value: () => root.dataset["value"] ?? "",
  };
};
