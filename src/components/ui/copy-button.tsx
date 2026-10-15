import { type ReactElement, useCallback, useEffect, useState } from "react";

interface CopyButtonProps {
  ariaLabel: string;
  copiedLabel: string;
  errorLabel: string;
  getValue: () => string;
  label: string;
}

type CopyStatus = "copied" | "error" | "idle";

const resetAfter = 2000;

const useCopyToClipboard = (): {
  copy: (text: string) => Promise<void>;
  status: CopyStatus;
} => {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const [ticket, setTicket] = useState(0);

  useEffect(() => {
    if (ticket === 0) return;
    const timer = setTimeout(() => {
      setStatus("idle");
    }, resetAfter);
    return (): void => {
      clearTimeout(timer);
    };
  }, [ticket]);

  const copy = useCallback(async (text: string): Promise<void> => {
    if (text === "") return;
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
    setTicket((value) => value + 1);
  }, []);

  return { copy, status };
};

const announcement = (
  status: CopyStatus,
  copiedLabel: string,
  errorLabel: string
): string => {
  if (status === "copied") return copiedLabel;
  return status === "error" ? errorLabel : "";
};

export const CopyButton = ({
  ariaLabel,
  copiedLabel,
  errorLabel,
  getValue,
  label,
}: CopyButtonProps): ReactElement => {
  const { copy, status } = useCopyToClipboard();
  return (
    <button
      aria-label={ariaLabel}
      className="copy-key mat-cap focus-ring"
      data-status={status}
      onClick={() => {
        void copy(getValue());
      }}
      type="button"
    >
      <span data-face="idle">{label}</span>
      <svg
        aria-hidden="true"
        data-face="copied"
        fill="none"
        height="11"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        viewBox="0 0 14 14"
        width="11"
      >
        <path d="M2.9 7.4 5.6 10.1 11.1 4" />
      </svg>
      <svg
        aria-hidden="true"
        data-face="error"
        fill="none"
        height="11"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        viewBox="0 0 14 14"
        width="11"
      >
        <path d="M3.6 3.6 10.4 10.4M10.4 3.6 3.6 10.4" />
      </svg>
      <span className="sr-only" role="status">
        {announcement(status, copiedLabel, errorLabel)}
      </span>
    </button>
  );
};
