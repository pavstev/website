import { type ReactElement } from "react";

import { useAsyncAction } from "@/components/ui/loading-button";

interface CopyButtonProps {
  ariaLabel: string;
  copiedLabel: string;
  errorLabel: string;
  getValue: () => string;
  label: string;
}

const statusOf = {
  error: "error",
  idle: "idle",
  pending: "idle",
  success: "copied",
} as const;

export const CopyButton = ({
  ariaLabel,
  copiedLabel,
  errorLabel,
  getValue,
  label,
}: CopyButtonProps): ReactElement => {
  const { run, status } = useAsyncAction({
    action: () => navigator.clipboard.writeText(getValue()),
    resetAfter: 2000,
  });
  const shown = statusOf[status];
  return (
    <button
      aria-label={ariaLabel}
      className="copy-key mat-cap focus-ring"
      data-status={shown}
      onClick={() => {
        if (getValue() !== "") run();
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
        {{ copied: copiedLabel, error: errorLabel, idle: "" }[shown]}
      </span>
    </button>
  );
};
