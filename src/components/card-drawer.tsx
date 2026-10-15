import {
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { RepoPlanetsCanvas } from "@/components/repo-planets-canvas";
import { Drawer } from "@/components/ui/drawer";

interface CardDrawerProps {
  children?: ReactNode;
  closeLabel: string;
  id: string;
  title: string;
}

const pageUrl = (): string =>
  `${globalThis.location.pathname}${globalThis.location.search}`;

const isHere = (id: string): boolean =>
  decodeURIComponent(globalThis.location.hash.slice(1)) === id;

export const CardDrawer = ({
  children,
  closeLabel,
  id,
  title,
}: CardDrawerProps): ReactElement => {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const flags = useRef({ open: false, pushed: false });

  const close = useCallback((): void => {
    if (!flags.current.open) return;
    flags.current.open = false;
    setOpen(false);
    if (isHere(id)) {
      if (flags.current.pushed) globalThis.history.back();
      else {
        globalThis.history.replaceState(
          globalThis.history.state,
          "",
          pageUrl()
        );
      }
    }
    flags.current.pushed = false;
  }, [id]);

  useEffect(() => {
    const show = (fromPage: boolean): void => {
      if (flags.current.open) return;
      flags.current.open = true;
      flags.current.pushed = fromPage;
      setOpen(true);
      setShown(true);
    };
    const sync = (fromPage: boolean): void => {
      if (isHere(id)) show(fromPage);
      else close();
    };
    const onHashChange = (): void => {
      sync(true);
    };
    const onLink = (event: MouseEvent): void => {
      if (!event.defaultPrevented) return;
      const link =
        event.target instanceof Element ? event.target.closest("a") : null;
      if (link?.getAttribute("href") === `#${id}`) show(true);
    };
    globalThis.addEventListener("hashchange", onHashChange);
    document.addEventListener("click", onLink);
    sync(false);
    return () => {
      globalThis.removeEventListener("hashchange", onHashChange);
      document.removeEventListener("click", onLink);
    };
  }, [close, id]);

  return (
    <Drawer
      className="card-drawer"
      closeLabel={closeLabel}
      id={id}
      onClosed={() => {
        setShown(false);
        document
          .querySelector<HTMLElement>(`a[href="#${CSS.escape(id)}"]`)
          ?.focus();
      }}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      open={open}
      sheet
      title={title}
    >
      <div className="drawer-stage" data-strips="">
        {children}
        <RepoPlanetsCanvas active={shown} />
      </div>
    </Drawer>
  );
};
