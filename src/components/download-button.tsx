"use client";

import { type ReactElement, type ReactNode, useEffect, useRef } from "react";

import { Icon } from "@/components/icon";
import { initDownloadRing } from "@/lib/download-ring";
import { en } from "@/lib/i18n";
import { initPillAurora } from "@/lib/pill-aurora";

interface DownloadButtonProps {
  children: ReactNode;
  describedBy: string;
}

export const DownloadButton = ({
  children,
  describedBy,
}: DownloadButtonProps): ReactElement => {
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
    <span className="download-item">
      <a
        aria-describedby={describedBy}
        aria-label={en.card.downloadPdf}
        className="download-pill focus-ring relative inline-flex h-11 items-center justify-center-safe overflow-hidden rounded-lg pr-5 pl-3.5 font-sans text-[0.875rem] font-semibold whitespace-nowrap text-foreground no-underline select-none"
        data-astro-prefetch="false"
        download="Stevan_Pavlovic_Resume.pdf"
        href="/resume.pdf"
        ref={ref}
      >
        <span aria-hidden="true" className="download-aurora">
          <span className="download-aurora-field" ref={fieldRef} />
        </span>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute -top-px -left-px size-11 opacity-0"
          data-ring=""
          fill="none"
          viewBox="0 0 44 44"
        >
          <path
            d="M22 2H34A8 8 0 0 1 42 10V34A8 8 0 0 1 34 42H10A8 8 0 0 1 2 34V10A8 8 0 0 1 10 2Z"
            data-ring-arc=""
            pathLength="100"
            stroke="currentColor"
            strokeDasharray="100"
            strokeDashoffset="100"
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
      {children}
      <span
        aria-live="polite"
        className="sr-only"
        ref={statusRef}
        role="status"
      />
    </span>
  );
};
