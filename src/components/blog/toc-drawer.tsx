"use client";

import { type ReactElement, useEffect, useRef, useState } from "react";

import { Drawer } from "@/components/ui/drawer";
import { branchOf, type TocItem } from "@/lib/blog/toc";
import { en } from "@/lib/i18n";

interface TocDrawerProps {
  items: readonly TocItem[];
}

const openerSelector = "[data-toc-open]";

export const TocDrawer = ({ items }: TocDrawerProps): ReactElement => {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const openers = [...document.querySelectorAll<HTMLElement>(openerSelector)];
    for (const node of openers) node.setAttribute("aria-expanded", "false");
    const onOpen = (event: MouseEvent): void => {
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(openerSelector)
          : null;
      if (!target) return;
      opener.current = target;
      setOpen(true);
    };
    document.addEventListener("click", onOpen);
    return () => {
      document.removeEventListener("click", onOpen);
    };
  }, []);

  useEffect(() => {
    for (const node of document.querySelectorAll(openerSelector))
      node.setAttribute("aria-expanded", open ? "true" : "false");
  }, [open]);

  return (
    <Drawer
      className="toc-drawer"
      closeLabel={en.blog.tocClose}
      id="toc-drawer"
      onClosed={() => {
        if (opener.current?.isConnected)
          opener.current.focus({ preventScroll: true });
      }}
      onOpenChange={setOpen}
      open={open}
      title={en.blog.toc}
    >
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
                setOpen(false);
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
    </Drawer>
  );
};
