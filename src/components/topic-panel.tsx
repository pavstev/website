import type { ReactElement, ReactNode } from "react";

import { Icon } from "@/components/icon";
import { en } from "@/lib/i18n";

interface TopicPanelProps {
  children?: ReactNode;
  heading: ReactNode;
  id: string;
  text: string;
  titleId: string;
  topic: string;
}

export const TopicPanel = ({
  children,
  heading,
  id,
  text,
  titleId,
  topic,
}: TopicPanelProps): ReactElement => (
  <div
    aria-labelledby={titleId}
    className="topic-panel"
    data-anchored=""
    data-topic={topic}
    id={id}
    popover="auto"
    role="dialog"
  >
    <header className="topic-head">
      {heading}
      <button
        aria-label={en.card.close}
        className="topic-close focus-ring"
        popoverTarget={id}
        popoverTargetAction="hide"
        type="button"
      >
        <Icon aria-hidden name="lucide:x" size="1rem" />
      </button>
    </header>
    <p className="topic-text">{text}</p>
    {children}
  </div>
);
