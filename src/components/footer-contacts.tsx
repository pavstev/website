import { type ReactElement, useId } from "react";

import { Icon } from "@/components/icon";
import { Tooltip, TooltipGroup } from "@/components/ui/tooltip";
import { type FooterLink } from "@/lib/footer-links";
import { en } from "@/lib/i18n";

interface FooterContactsProps {
  links: FooterLink[];
}

export const FooterContacts = ({
  links,
}: FooterContactsProps): ReactElement => {
  const noteId = useId();

  return (
    <TooltipGroup>
      <ul aria-label={en.footer.links} className="footer-keys">
        {links.map((link) => (
          <li key={link.id}>
            <Tooltip label={link.label}>
              <a
                aria-describedby={
                  link.external ? `${noteId}-${link.id}` : undefined
                }
                aria-label={link.label}
                className="footer-key keycap-host focus-ring"
                data-astro-reload={link.external ? undefined : ""}
                href={link.href}
                rel={link.external ? "me noopener noreferrer" : undefined}
                target={link.external ? "_blank" : undefined}
                type={link.type}
              >
                <span className="keycap">
                  <Icon aria-hidden name={link.icon} size="0.9375rem" />
                </span>
                {link.external && (
                  <span className="sr-only" id={`${noteId}-${link.id}`}>
                    {en.card.newTab}
                  </span>
                )}
              </a>
            </Tooltip>
          </li>
        ))}
      </ul>
    </TooltipGroup>
  );
};
