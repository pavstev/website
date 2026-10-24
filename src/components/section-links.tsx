import type { CSSProperties, ReactElement } from "react";

import { Icon } from "@/components/icon";
import { Tooltip, TooltipGroup } from "@/components/ui/tooltip";
import { contactAvoid } from "@/lib/contact-links";
import { en } from "@/lib/i18n";

export interface SectionLink {
  art: SectionArt;
  detail: string;
  dots: Array<string | undefined>;
  href: string;
  icon: string;
  label: string;
  name: string;
}

type SectionArt = "card" | "page" | "rows";

interface SectionLinksProps {
  sections: SectionLink[];
}

const pageLines = [58, 92, 80, 88];

const line = (index: number, width: number): ReactElement => (
  <span
    className="tip-line"
    key={index}
    style={{ "--i": index, "--w": `${String(width)}%` } as CSSProperties}
  />
);

const SectionArtwork = ({
  art,
  dots,
}: Pick<SectionLink, "art" | "dots">): ReactElement => {
  if (art === "card") {
    return (
      <span aria-hidden="true" className="tip-page tip-card">
        <span className="tip-card-face" />
        {line(0, 70)}
        {line(1, 92)}
        {line(2, 54)}
      </span>
    );
  }
  if (art === "rows") {
    return (
      <span aria-hidden="true" className="tip-page tip-rows">
        {dots.map((color, index) => (
          <span
            className="tip-row"
            key={`${String(index)}-${color ?? ""}`}
            style={{ "--dot": color, "--i": index } as CSSProperties}
          >
            <span className="tip-dot" />
            <span className="tip-row-line" />
          </span>
        ))}
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="tip-page">
      {pageLines.map((width, index) => line(index, width))}
    </span>
  );
};

export const SectionLinks = ({ sections }: SectionLinksProps): ReactElement => (
  <TooltipGroup>
    <ul
      aria-label={en.card.sections}
      className="section-row fade-up relative z-1 mt-(--card-gap-sections) delay-3"
      data-proximity=""
      data-sections=""
    >
      {sections.map((section) => (
        <li className="section-item" key={section.href}>
          <Tooltip
            avoid={contactAvoid}
            label={
              <span className="tip-sheet">
                <SectionArtwork art={section.art} dots={section.dots} />
                <span className="tip-text">
                  <span className="tip-name">{section.name}</span>
                  <span className="tip-detail">{section.detail}</span>
                </span>
              </span>
            }
            side="bottom"
          >
            <a
              className="section-link keycap-host focus-ring"
              href={section.href}
            >
              <span className="keycap">
                <span aria-hidden="true" className="section-icon contact-icon">
                  <Icon name={section.icon} size="0.9375rem" />
                </span>
                <span className="section-label">{section.label}</span>
              </span>
            </a>
          </Tooltip>
        </li>
      ))}
    </ul>
  </TooltipGroup>
);
