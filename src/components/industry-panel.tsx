import type { ReactElement } from "react";

import { Icon } from "@/components/icon";
import { TopicHeading } from "@/components/topic-heading";
import { TopicPanel } from "@/components/topic-panel";
import { type Industry } from "@/lib/industries";

interface IndustryPanelProps {
  industry: Industry;
}

export const IndustryPanel = ({
  industry,
}: IndustryPanelProps): ReactElement => {
  const titleId = `${industry.panelId}-title`;
  return (
    <TopicPanel
      heading={
        <TopicHeading
          emblem={
            <span className="topic-emblem industry-emblem">
              <Icon aria-hidden name={industry.icon} size="0.875rem" />
            </span>
          }
          subtitle={industry.subtitle}
          title={industry.title}
          titleId={titleId}
        />
      }
      id={industry.panelId}
      text={industry.facts}
      titleId={titleId}
      topic={industry.key}
    />
  );
};
