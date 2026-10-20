import type { ReactElement } from "react";

import type { Contact } from "@/lib/github";

import { Icon } from "@/components/icon";
import { Tooltip } from "@/components/ui/tooltip";
import { contactAvoid } from "@/lib/contact-links";
import { en } from "@/lib/i18n";
import { personalData as personal } from "@/lib/personal";

interface ContactLinksProps {
  contact: Contact;
}

export const ContactLinks = ({
  contact: profile,
}: ContactLinksProps): ReactElement => {
  const contacts = [
    {
      detail: profile.email,
      external: false,
      href: `mailto:${profile.email}`,
      icon: "lucide:mail",
      id: "email",
      label: en.card.email,
      tone: "blue",
    },
    {
      detail: personal.githubHandle,
      external: true,
      href: personal.github,
      icon: "simple-icons:github",
      id: "github",
      label: en.card.github,
      tone: "purple",
    },
    {
      detail: profile.linkedinHandle,
      external: true,
      href: profile.linkedin,
      icon: "simple-icons:linkedin",
      id: "linkedin",
      label: en.card.linkedin,
      tone: "green",
    },
  ];
  return (
    <ul
      aria-label={en.card.contactLabel}
      className="flex items-center justify-center gap-3"
      data-contacts=""
    >
      {contacts.map((contact) => (
        <li className="contact-item" data-tone={contact.tone} key={contact.id}>
          <Tooltip
            avoid={contactAvoid}
            label={
              <>
                <span className="contact-tip-name">{contact.label}</span>{" "}
                <span className="contact-tip-detail">{contact.detail}</span>
              </>
            }
          >
            <a
              aria-label={contact.label}
              className="contact-link keycap-host focus-ring size-9"
              href={contact.href}
              rel={contact.external ? "me noopener noreferrer" : undefined}
              target={contact.external ? "_blank" : undefined}
            >
              <span className="keycap">
                <span aria-hidden="true" className="contact-icon">
                  <Icon name={contact.icon} size="0.9375rem" />
                </span>
              </span>
            </a>
          </Tooltip>
        </li>
      ))}
    </ul>
  );
};
