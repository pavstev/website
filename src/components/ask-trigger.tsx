import type { ReactElement } from "react";

import { Icon } from "@/components/icon";
import { askPanelId } from "@/lib/ask";
import { en } from "@/lib/i18n";

const hintId = "ask-hint";

export const AskTrigger = (): ReactElement => (
  <div className="contact-item ask-item">
    <button
      aria-describedby={hintId}
      aria-haspopup="dialog"
      aria-label={en.ask.button}
      className="contact-link focus-ring inline-flex size-11 items-center justify-center rounded-lg"
      popoverTarget={askPanelId}
      type="button"
    >
      <span aria-hidden="true" className="contact-icon">
        <Icon name="lucide:message-circle" size="1.1em" />
      </span>
    </button>
    <span className="contact-tip" role="tooltip">
      <span className="contact-tip-name">{en.ask.button}</span>{" "}
      <span className="contact-tip-detail" id={hintId}>
        {en.ask.hint}
      </span>
    </span>
  </div>
);
