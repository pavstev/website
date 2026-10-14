import type { ReactElement } from "react";

import type { Industry, IndustryJob } from "@/lib/industries";

import { Icon } from "@/components/icon";
import { TopicHeading } from "@/components/topic-heading";
import { TopicPanel } from "@/components/topic-panel";
import { en } from "@/lib/i18n";

interface IndustryPanelProps {
  industry: Industry;
  job: IndustryJob;
}

export const IndustryPanel = ({
  industry,
  job,
}: IndustryPanelProps): ReactElement => {
  const titleId = `${industry.panelId}-title`;
  const company =
    job.site === "" ? (
      <span className="topic-company">{job.company}</span>
    ) : (
      <a
        className="topic-company focus-ring"
        href={job.site}
        rel="noopener noreferrer"
        target="_blank"
      >
        {job.company}
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
              {job.period}
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
