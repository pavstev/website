import type { ReactElement } from "react";

import { en } from "@/lib/i18n";
import { personalData } from "@/lib/personal";

const panelId = "privacy-panel";

export const PrivacyNote = (): ReactElement => (
  <footer className="privacy-note">
    <button className="privacy-chip" popoverTarget={panelId} type="button">
      <span className="privacy-chip-face fade-up type-chip delay-4">
        <span aria-hidden="true" className="privacy-dot" />
        {en.privacy.chip}
      </span>
    </button>
    <div className="privacy-panel" id={panelId} popover="auto">
      <p className="privacy-lead">{en.privacy.local}</p>
      <p>{en.privacy.host}</p>
      <p className="privacy-contact">
        {en.privacy.contact}{" "}
        <a
          className="privacy-mail focus-ring"
          href={`mailto:${personalData.email}`}
        >
          {personalData.email}
        </a>
      </p>
    </div>
  </footer>
);
