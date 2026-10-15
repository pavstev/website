import type { CSSProperties, ReactElement } from "react";

import type { ResumeFacts } from "@/lib/resume-facts";

import { en } from "@/lib/i18n";
import { fillCount, pluralForm } from "@/lib/template";

const lineWidths = [58, 92, 80, 88, 64];

interface ResumeTipProps {
  facts: ResumeFacts;
}

const describe = ({ kilobytes, pages }: ResumeFacts): string =>
  en.card.resumeFacts
    .replace("{pages}", () =>
      fillCount(
        pluralForm(pages, en.card.resumePagesOne, en.card.resumePagesOther),
        pages
      )
    )
    .replace("{size}", () =>
      en.card.resumeSize.replace("{size}", () => String(kilobytes))
    );

export const ResumeTip = ({ facts }: ResumeTipProps): ReactElement => (
  <span className="resume-sheet">
    <span aria-hidden="true" className="resume-page">
      {lineWidths.map((width, index) => (
        <span
          className="resume-line"
          key={width}
          style={{ "--i": index, "--w": `${String(width)}%` } as CSSProperties}
        />
      ))}
    </span>
    <span className="resume-tip-text">
      <span className="resume-tip-name">{en.card.resume}</span>
      <span className="resume-tip-detail">{describe(facts)}</span>
    </span>
  </span>
);
