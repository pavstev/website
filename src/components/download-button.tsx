import type { ReactElement, ReactNode } from "react";

import { Icon } from "@/components/icon";
import { LoadingFaces, useAsyncAction } from "@/components/ui/loading-button";
import { Tooltip } from "@/components/ui/tooltip";
import { contactAvoid } from "@/lib/contact-links";
import { en } from "@/lib/i18n";

interface DownloadButtonProps {
  tip: ReactNode;
}

const minPendingMs = 450;

const labels = {
  error: en.card.downloadFailed,
  idle: en.card.downloadPdf,
  pending: en.card.downloading,
  success: en.card.downloaded,
};

const confirmDownload = async (): Promise<void> => {
  const [response] = await Promise.all([
    fetch("/resume.pdf", { cache: "force-cache" }),
    new Promise<void>((resolve) => {
      setTimeout(resolve, minPendingMs);
    }),
  ]);
  if (!response.ok) throw new Error(String(response.status));
  await response.arrayBuffer();
};

export const DownloadButton = ({ tip }: DownloadButtonProps): ReactElement => {
  const { run, status } = useAsyncAction({ action: confirmDownload });

  return (
    <>
      <Tooltip avoid={contactAvoid} className="download-item" label={tip}>
        <a
          aria-label={en.card.downloadPdf}
          className="download-pill keycap-host focus-ring no-underline select-none"
          data-astro-prefetch="false"
          data-busy={status === "pending" ? "" : undefined}
          download="Stevan_Pavlovic_Resume.pdf"
          href="/resume.pdf"
          onClick={(event) => {
            if (event.button === 0 && !event.ctrlKey && !event.metaKey) run();
          }}
        >
          <span aria-hidden="true" className="keycap-base" />
          <span className="keycap">
            <LoadingFaces
              idleIcon={
                <span className="download-icon grid size-3.75 place-items-center">
                  <Icon name="lucide:download" size="0.9375rem" />
                </span>
              }
              labels={labels}
              status={status}
            />
          </span>
        </a>
      </Tooltip>
      <span aria-live="polite" className="sr-only" role="status">
        {status === "idle" ? "" : labels[status]}
      </span>
    </>
  );
};
