"use client";

import {
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

interface ImageZoomProps {
  alt: string;
  children: ReactNode;
  height: number;
  label: string;
  src: string;
  width: number;
}

const wideQuery = "(min-width: 48em)";

const subscribe = (onChange: () => void): (() => void) => {
  const media = globalThis.matchMedia(wideQuery);
  media.addEventListener("change", onChange);
  return () => {
    media.removeEventListener("change", onChange);
  };
};

const isWide = (): boolean => globalThis.matchMedia(wideQuery).matches;

const serverWide = (): boolean => false;

const activationKeys = new Set([" ", "Enter"]);

export const ImageZoom = ({
  alt,
  children,
  height,
  label,
  src,
  width,
}: ImageZoomProps): ReactElement => {
  const wide = useSyncExternalStore(subscribe, isWide, serverWide);
  const [opened, setOpened] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const open = (): void => {
    setOpened(true);
    dialogRef.current?.showModal();
  };
  const openByKey = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!activationKeys.has(event.key)) {
      return;
    }

    event.preventDefault();
    open();
  };
  const close = (): void => {
    dialogRef.current?.close();
  };
  const restoreFocus = (): void => {
    triggerRef.current?.focus({ preventScroll: true });
  };
  const trigger = wide
    ? {
        "aria-haspopup": "dialog" as const,
        "aria-label": label,
        onClick: open,
        onKeyDown: openByKey,
        role: "button",
        tabIndex: 0,
      }
    : {};
  return (
    <>
      <div className="image-zoom focus-ring" ref={triggerRef} {...trigger}>
        {children}
      </div>
      <dialog
        aria-label={alt}
        className="image-zoom-dialog"
        onClick={close}
        onClose={restoreFocus}
        ref={dialogRef}
      >
        {opened && (
          <img
            alt={alt}
            className="image-zoom-full"
            decoding="async"
            height={height}
            src={src}
            width={width}
          />
        )}
      </dialog>
    </>
  );
};
