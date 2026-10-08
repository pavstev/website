import type { CSSProperties, ReactElement } from "react";

import type { ResumeFacts } from "@/lib/resume-facts";

import { en } from "@/lib/i18n";

const plural = new Intl.PluralRules("en");

const lineWidths = [58, 92, 80, 88, 64];

interface ResumeTipProps {
  detailId: string;
  facts: ResumeFacts;
}

const describe = ({ kilobytes, pages }: ResumeFacts): string =>
  en.card.resumeFacts
    .replace("{pages}", () =>
      (plural.select(pages) === "one"
        ? en.card.resumePagesOne
        : en.card.resumePagesOther
      ).replace("{count}", () => String(pages))
    )
    .replace("{size}", () =>
      en.card.resumeSize.replace("{size}", () => String(kilobytes))
    );

export const ResumeTip = ({
  detailId,
  facts,
}: ResumeTipProps): ReactElement => (
  <span className="resume-tip" role="tooltip">
    <span className="resume-sheet">
      <span aria-hidden="true" className="resume-page">
        {lineWidths.map((width, index) => (
          <span
            className="resume-line"
            key={width}
            style={
              { "--i": index, "--w": `${String(width)}%` } as CSSProperties
            }
          />
        ))}
      </span>
      <span className="resume-tip-text">
        <span className="resume-tip-name">{en.card.resume}</span>
        <span className="resume-tip-detail" id={detailId}>
          {describe(facts)}
        </span>
      </span>
    </span>
  </span>
);
