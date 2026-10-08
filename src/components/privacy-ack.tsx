"use client";

import type { ReactElement } from "react";

import { en } from "@/lib/i18n";
import { privacyAckKey, privacyClosedAttribute } from "@/lib/privacy-ack";

interface PrivacyAckProps {
  panelId: string;
}

export const PrivacyAck = ({ panelId }: PrivacyAckProps): ReactElement => {
  const acknowledge = (): void => {
    try {
      globalThis.localStorage.setItem(privacyAckKey, "1");
    } catch {}
    document.querySelector<HTMLElement>(`#${panelId}`)?.hidePopover();
    document.documentElement.toggleAttribute(privacyClosedAttribute, true);
  };
  return (
    <button
      className="privacy-ack focus-ring"
      onClick={acknowledge}
      type="button"
    >
      {en.privacy.acknowledge}
    </button>
  );
};
