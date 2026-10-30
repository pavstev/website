import type { ReactElement } from "react";

import { Icon } from "@/components/icon";
import { TipLabel } from "@/components/tip-label";
import { Tooltip, TooltipGroup } from "@/components/ui/tooltip";
import { contactAvoid } from "@/lib/contact-links";
import { en } from "@/lib/i18n";

export interface SectionLink {
  detail: string;
  href: string;
  icon: string;
  label: string;
  name: string;
}

interface SectionLinksProps {
  sections: SectionLink[];
}

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
            label={<TipLabel detail={section.detail} name={section.name} />}
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
