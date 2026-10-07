"use client";

import { type ReactElement, useEffect, useRef } from "react";

import { Icon } from "@/components/icon";
import { initDownloadRing } from "@/lib/download-ring";
import { en } from "@/lib/i18n";
import { initPillAurora } from "@/lib/pill-aurora";

export const DownloadButton = (): ReactElement => {
  const ref = useRef<HTMLAnchorElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const fieldRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const anchor = ref.current;
    const status = statusRef.current;
    const field = fieldRef.current;
    if (!anchor || !status || !field) return;
    const disposeRing = initDownloadRing(anchor, status, {
      downloaded: en.card.downloaded,
      downloading: en.card.downloading,
      idle: en.card.downloadPdf,
    });
    const disposeAurora = initPillAurora(anchor, field);
    return () => {
      disposeAurora();
      disposeRing();
    };
  }, []);

  return (
    <>
      <a
        aria-label={en.card.downloadPdf}
        className="download-pill focus-ring relative inline-flex h-11 items-center justify-center-safe overflow-hidden rounded-full bg-primary pr-5 pl-3 font-sans text-[0.875rem] font-medium whitespace-nowrap text-primary-foreground no-underline transition-colors duration-(--duration-normal) ease-(--ease-smooth) select-none hover:bg-(--primary-hover)"
        download="Stevan_Pavlovic_Resume.pdf"
        href="/resume.pdf"
        ref={ref}
      >
        <span aria-hidden="true" className="download-aurora">
          <span className="download-aurora-field" ref={fieldRef} />
        </span>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 size-11 -rotate-90 opacity-0"
          data-ring=""
          fill="none"
          viewBox="0 0 44 44"
        >
          <circle
            cx="22"
            cy="22"
            data-ring-arc=""
            r="20"
            stroke="currentColor"
            strokeDasharray="125.66"
            strokeDashoffset="125.66"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </svg>
        <span className="download-content relative inline-flex items-center gap-2">
          <span aria-hidden="true" className="relative block size-5 shrink-0">
            <span
              className="absolute inset-0 grid place-items-center"
              data-icon-download=""
            >
              <Icon name="lucide:download" size="1.25em" />
            </span>
            <span
              className="absolute inset-0 grid place-items-center opacity-0"
              data-icon-check=""
            >
              <Icon name="lucide:check" size="1.25em" />
            </span>
          </span>
          <span data-label="">{en.card.downloadPdf}</span>
        </span>
      </a>
      <span
        aria-live="polite"
        className="sr-only"
        ref={statusRef}
        role="status"
      />
    </>
  );
};
