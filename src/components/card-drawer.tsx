"use client";

import {
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import { RepoPlanetsCanvas } from "@/components/repo-planets-canvas";

interface CardDrawerProps {
  children: ReactNode;
  closeIcon: ReactNode;
  closeLabel: string;
  id: string;
  title: string;
}

const pageUrl = (): string =>
  `${globalThis.location.pathname}${globalThis.location.search}`;

export const CardDrawer = ({
  children,
  closeIcon,
  closeLabel,
  id,
  title,
}: CardDrawerProps): ReactElement => {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const here = (): boolean =>
      decodeURIComponent(globalThis.location.hash.slice(1)) === id;
    let pushed = false;
    const show = (fromPage: boolean): void => {
      if (dialog.open) return;
      pushed = fromPage;
      dialog.showModal();
      dialog.querySelector<HTMLElement>(".drawer-close")?.focus();
      setOpen(true);
    };
    const sync = (fromPage: boolean): void => {
      if (here()) show(fromPage);
      else if (dialog.open) dialog.close();
    };
    const onHashChange = (): void => {
      sync(true);
    };
    const onClose = (): void => {
      setOpen(false);
      if (here()) {
        if (pushed) globalThis.history.back();
        else {
          globalThis.history.replaceState(
            globalThis.history.state,
            "",
            pageUrl()
          );
        }
      }
      pushed = false;
      document
        .querySelector<HTMLElement>(`a[href="#${CSS.escape(id)}"]`)
        ?.focus();
    };
    const onClick = (event: MouseEvent): void => {
      if (event.target === dialog) dialog.close();
    };
    dialog.addEventListener("close", onClose);
    dialog.addEventListener("click", onClick);
    globalThis.addEventListener("hashchange", onHashChange);
    sync(false);
    return () => {
      dialog.removeEventListener("close", onClose);
      dialog.removeEventListener("click", onClick);
      globalThis.removeEventListener("hashchange", onHashChange);
    };
  }, [id]);

  return (
    <dialog
      aria-labelledby={`${id}-title`}
      className="card-drawer"
      data-drawer={id}
      id={id}
      ref={ref}
    >
      <div className="drawer-sheet">
        <header className="drawer-head">
          <h2 className="drawer-title" id={`${id}-title`}>
            {title}
          </h2>
          <button
            aria-label={closeLabel}
            className="drawer-close topic-close focus-ring"
            onClick={() => {
              ref.current?.close();
            }}
            type="button"
          >
            {closeIcon}
          </button>
        </header>
        <div className="drawer-body">
          <div className="drawer-stage" data-strips="">
            {children}
            <RepoPlanetsCanvas active={open} />
          </div>
        </div>
      </div>
    </dialog>
  );
};
