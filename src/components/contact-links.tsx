import type { ReactElement } from "react";

import type { Contact } from "@/lib/github";

import { ContactKey } from "@/components/contact-key";
import { contactEntries } from "@/lib/contact-links";
import { en } from "@/lib/i18n";

interface ContactLinksProps {
  contact: Contact;
}

export const ContactLinks = ({ contact }: ContactLinksProps): ReactElement => (
  <ul
    aria-label={en.card.contactLabel}
    className="flex items-center justify-center gap-3"
    data-contacts=""
  >
    {contactEntries(contact).map(({ id, ...entry }) => (
      <ContactKey key={id} linkClassName="size-9" {...entry} />
    ))}
  </ul>
);
