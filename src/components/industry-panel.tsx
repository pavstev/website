import type { ReactElement } from "react";

import { Icon } from "@/components/icon";
import { TopicHeading } from "@/components/topic-heading";
import { TopicPanel } from "@/components/topic-panel";
import { en } from "@/lib/i18n";
import { type Industry } from "@/lib/industries";

interface IndustryPanelProps {
  industry: Industry;
}

export const IndustryPanel = ({
  industry,
}: IndustryPanelProps): ReactElement => {
  const titleId = `${industry.panelId}-title`;
  const company = (
    <a
      className="topic-company focus-ring"
      href={industry.site}
      rel="noopener noreferrer"
      target="_blank"
    >
      {industry.company}
      <span className="sr-only"> {en.industries.newTab}</span>
    </a>
  );
  return (
    <TopicPanel
      heading={
        <TopicHeading
          emblem={
            <span className="topic-emblem industry-emblem">
              <Icon aria-hidden name={industry.icon} size="0.875rem" />
            </span>
          }
          subtitle={
            <>
              {company}
              {en.industries.separator}
              {industry.period}
            </>
          }
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
