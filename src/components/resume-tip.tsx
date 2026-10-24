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
  <span className="tip-sheet">
    <span aria-hidden="true" className="tip-page">
      {lineWidths.map((width, index) => (
        <span
          className="tip-line"
          key={width}
          style={{ "--i": index, "--w": `${String(width)}%` } as CSSProperties}
        />
      ))}
    </span>
    <span className="tip-text">
      <span className="tip-name">{en.card.resume}</span>
      <span className="tip-detail">{describe(facts)}</span>
    </span>
  </span>
);
