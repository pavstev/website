"use client";

import { type ReactElement, useEffect, useRef } from "react";

import { Icon } from "@/components/icon";
import { branchOf, type TocItem } from "@/lib/blog/toc";
import { en } from "@/lib/i18n";

interface TocDrawerProps {
  items: readonly TocItem[];
}

const openerSelector = "[data-toc-open]";

export const TocDrawer = ({ items }: TocDrawerProps): ReactElement => {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const openers = [...document.querySelectorAll<HTMLElement>(openerSelector)];
    const onOpen = (event: MouseEvent): void => {
      const target =
        event.target instanceof Element
          ? event.target.closest(openerSelector)
          : null;
      if (!target || dialog.open) return;
      dialog.showModal();
      for (const opener of openers)
        opener.setAttribute("aria-expanded", "true");
    };
    const onClose = (): void => {
      for (const opener of openers)
        opener.setAttribute("aria-expanded", "false");
    };
    for (const opener of openers) opener.setAttribute("aria-expanded", "false");
    document.addEventListener("click", onOpen);
    dialog.addEventListener("close", onClose);
    return () => {
      document.removeEventListener("click", onOpen);
      dialog.removeEventListener("close", onClose);
      if (dialog.open) dialog.close();
    };
  }, []);

  const close = (): void => {
    ref.current?.close();
  };

  return (
    <dialog
      aria-labelledby="toc-drawer-title"
      className="toc-drawer"
      id="toc-drawer"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      ref={ref}
    >
      <div className="toc-drawer-panel">
        <div className="toc-drawer-head">
          <h2 className="toc-drawer-title type-chip" id="toc-drawer-title">
            {en.blog.toc}
          </h2>
          <button
            aria-label={en.blog.tocClose}
            className="toc-drawer-close focus-ring"
            onClick={close}
            type="button"
          >
            <Icon name="lucide:x" size="1rem" />
          </button>
        </div>
        <ol className="toc-list">
          {items.map((item, index) => (
            <li
              className="toc-item"
              data-branch={branchOf(items, index)}
              data-depth={item.depth}
              key={item.id}
            >
              <a
                className="toc-link focus-ring"
                href={`#${item.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  close();
                  if (globalThis.location.hash === `#${item.id}`)
                    document
                      .querySelector(`#${CSS.escape(item.id)}`)
                      ?.scrollIntoView();
                  else globalThis.location.hash = item.id;
                }}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </dialog>
  );
};
