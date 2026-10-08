import type { ReactElement } from "react";

import { PrivacyAck } from "@/components/privacy-ack";
import { en } from "@/lib/i18n";

const panelId = "privacy-panel";

interface PrivacyNoteProps {
  ask: boolean;
  email: string;
}

export const PrivacyNote = ({ ask, email }: PrivacyNoteProps): ReactElement => (
  <footer className="privacy-note">
    <button className="privacy-chip" popoverTarget={panelId} type="button">
      <span className="privacy-chip-face fade-up type-chip delay-4">
        <span aria-hidden="true" className="privacy-dot" />
        {en.privacy.chip}
      </span>
    </button>
    <div className="privacy-panel" id={panelId} popover="auto">
      <p className="privacy-lead">{en.privacy.local}</p>
      <p>{en.privacy.stats}</p>
      <p>{en.privacy.host}</p>
      {ask ? <p>{en.privacy.ask}</p> : null}
      <p className="privacy-contact">
        {en.privacy.contact}{" "}
        <a className="privacy-mail focus-ring" href={`mailto:${email}`}>
          {email}
        </a>
      </p>
      <div className="privacy-actions">
        <p className="privacy-stored">{en.privacy.stored}</p>
        <PrivacyAck panelId={panelId} />
      </div>
    </div>
  </footer>
);
