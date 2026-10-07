import type { ReactElement } from "react";

import { Icon } from "@/components/icon";
import { en } from "@/lib/i18n";
import { personalData as personal } from "@/lib/personal";

export const ContactLinks = (): ReactElement => {
  const contacts = [
    {
      detail: personal.email,
      external: false,
      href: `mailto:${personal.email}`,
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
      detail: personal.linkedinHandle,
      external: true,
      href: personal.linkedin,
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
      data-proximity=""
    >
      {contacts.map((contact) => (
        <li className="contact-item" data-tone={contact.tone} key={contact.id}>
          <a
            aria-describedby={`contact-detail-${contact.id}`}
            aria-label={contact.label}
            className="contact-link focus-ring inline-flex size-11 items-center justify-center rounded-full"
            data-pointer-light=""
            href={contact.href}
            rel={contact.external ? "me noopener noreferrer" : undefined}
            target={contact.external ? "_blank" : undefined}
          >
            <span aria-hidden="true" className="contact-icon">
              <Icon name={contact.icon} size="1.1em" />
            </span>
          </a>
          <span
            className="contact-tip"
            id={`contact-tip-${contact.id}`}
            role="tooltip"
          >
            <span className="contact-tip-name">{contact.label}</span>{" "}
            <span
              className="contact-tip-detail"
              id={`contact-detail-${contact.id}`}
            >
              {contact.detail}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
};
