import type { ReactElement, ReactNode } from "react";

interface TopicHeadingProps {
  emblem: ReactNode;
  subtitle: ReactNode;
  title: string;
  titleId: string;
}

export const TopicHeading = ({
  emblem,
  subtitle,
  title,
  titleId,
}: TopicHeadingProps): ReactElement => (
  <>
    {emblem}
    <div className="topic-titles">
      <h2 className="topic-title" id={titleId}>
        {title}
      </h2>
      <p className="topic-subtitle">{subtitle}</p>
    </div>
  </>
);
