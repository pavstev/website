const resetAfter = 2000;
const timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

const show = (button: HTMLElement, state: "copied" | "failed"): void => {
  button.dataset["state"] = state;
  const status =
    button.parentElement?.querySelector<HTMLElement>("[data-copy-status]");
  if (status) status.textContent = button.dataset[state] ?? "";
  globalThis.clearTimeout(timers.get(button));
  timers.set(
    button,
    globalThis.setTimeout(() => {
      delete button.dataset["state"];
      if (status) status.textContent = "";
    }, resetAfter)
  );
};

const onClick = async (event: Event): Promise<void> => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLElement>("[data-copy]");
  if (!button) return;
  try {
    await navigator.clipboard.writeText(button.dataset["copy"] ?? "");
    show(button, "copied");
  } catch {
    show(button, "failed");
  }
};

export const watchCopy = (): void => {
  document.addEventListener("click", (event) => {
    void onClick(event);
  });
};
