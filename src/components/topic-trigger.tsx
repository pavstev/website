import type { ReactElement } from "react";

interface TopicTriggerProps {
  label: string;
  panelId: string;
  topic: string;
  word: string;
}

export const TopicTrigger = ({
  label,
  panelId,
  topic,
  word,
}: TopicTriggerProps): ReactElement => (
  <button
    aria-haspopup="dialog"
    aria-label={label}
    className="topic-trigger focus-ring"
    data-topic={topic}
    popoverTarget={panelId}
    type="button"
  >
    <span className="topic-word">{word}</span>
  </button>
);
