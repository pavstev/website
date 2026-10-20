import { type ReactElement, useEffect, useId, useRef } from "react";

import type { ResumeFacts } from "@/lib/resume-facts";

import { ContactKey } from "@/components/contact-key";
import { ResumeTip } from "@/components/resume-tip";
import { TooltipGroup } from "@/components/ui/tooltip";
import { initCursorEffects } from "@/lib/cursor";
import { type FooterLink } from "@/lib/footer-links";
import { en } from "@/lib/i18n";

interface FooterContactsProps {
  facts: ResumeFacts;
  links: FooterLink[];
}

export const FooterContacts = ({
  facts,
  links,
}: FooterContactsProps): ReactElement => {
  const noteId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    return list ? initCursorEffects(list) : undefined;
  }, []);

  return (
    <TooltipGroup>
      <ul
        aria-label={en.footer.links}
        className="footer-keys"
        data-proximity=""
        ref={listRef}
      >
        {links.map(({ id, ...link }) => (
          <ContactKey
            describedBy={link.external ? `${noteId}-${id}` : undefined}
            key={id}
            linkClassName="footer-key"
            reload={!link.external}
            tip={id === "resume" ? <ResumeTip facts={facts} /> : undefined}
            {...link}
          >
            {link.external && (
              <span className="sr-only" id={`${noteId}-${id}`}>
                {en.card.newTab}
              </span>
            )}
          </ContactKey>
        ))}
      </ul>
    </TooltipGroup>
  );
};
