"use client";

import {
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type SyntheticEvent,
  useRef,
  useState,
} from "react";

import {
  createPortraitExpander,
  type PortraitExpanderControls,
} from "@/lib/portrait-expand";

interface PortraitExpanderProps {
  alt: string;
  children: ReactNode;
  closeIcon: ReactNode;
  closeLabel: string;
  dialogLabel: string;
  expandLabel: string;
  largeUrl: string;
}

export const PortraitExpander = ({
  alt,
  children,
  closeIcon,
  closeLabel,
  dialogLabel,
  expandLabel,
  largeUrl,
}: PortraitExpanderProps): ReactElement => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const lowRef = useRef<HTMLImageElement>(null);
  const highRef = useRef<HTMLImageElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const controlsRef = useRef<null | PortraitExpanderControls>(null);
  const [expanded, setExpanded] = useState(false);

  const controls = (): null | PortraitExpanderControls => {
    if (controlsRef.current) return controlsRef.current;
    const button = buttonRef.current;
    const dialog = dialogRef.current;
    const frame = frameRef.current;
    const low = lowRef.current;
    const high = highRef.current;
    if (!button || !dialog || !frame || !low || !high) return null;
    controlsRef.current = createPortraitExpander({
      button,
      dialog,
      frame,
      high,
      largeUrl,
      low,
    });
    return controlsRef.current;
  };

  const onOpen = (): void => {
    const expander = controls();
    if (!expander) return;
    expander.open();
    setExpanded(true);
    closeRef.current?.focus({ preventScroll: true });
  };

  const onClose = (): void => {
    controls()?.close();
  };

  const onCancel = (event: SyntheticEvent<HTMLDialogElement>): void => {
    event.preventDefault();
    controls()?.close();
  };

  const onClosed = (): void => {
    controls()?.reset();
    setExpanded(false);
    buttonRef.current?.focus({ preventScroll: true });
  };

  const onDialogClick = (event: MouseEvent<HTMLDialogElement>): void => {
    const { target } = event;
    if (target instanceof Element && target.closest("[data-expander-lens]")) {
      return;
    }
    controls()?.close();
  };

  const onHighLoad = (): void => {
    highRef.current?.setAttribute("data-loaded", "");
  };

  return (
    <>
      <button
        aria-expanded={expanded}
        aria-haspopup="dialog"
        aria-label={expandLabel}
        className="focus-ring relative block size-33.5 shrink-0 rounded-full md:size-38.5"
        data-portrait=""
        onClick={onOpen}
        ref={buttonRef}
        type="button"
      >
        {children}
      </button>
      <dialog
        aria-label={dialogLabel}
        className="portrait-dialog"
        onCancel={onCancel}
        onClick={onDialogClick}
        onClose={onClosed}
        ref={dialogRef}
      >
        <span
          aria-hidden="true"
          className="portrait-scrim"
          data-expander-scrim=""
        />
        <div className="portrait-stage" ref={frameRef}>
          <span className="portrait-lens" data-expander-lens="">
            <img
              alt=""
              aria-hidden="true"
              className="absolute inset-0 size-full object-cover object-top"
              decoding="async"
              ref={lowRef}
            />
            <img
              alt={alt}
              className="portrait-high absolute inset-0 size-full object-cover object-top"
              decoding="async"
              onLoad={onHighLoad}
              ref={highRef}
            />
          </span>
          <span className="portrait-halo" data-expander-halo="">
            <button
              aria-label={closeLabel}
              className="portrait-close focus-ring"
              onClick={onClose}
              ref={closeRef}
              type="button"
            >
              {closeIcon}
            </button>
          </span>
        </div>
      </dialog>
    </>
  );
};
