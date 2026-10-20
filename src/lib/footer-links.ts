import {
  contactEntries,
  type ContactEntry,
  type ContactSource,
  type ContactTone,
} from "./contact-links.ts";
import { en } from "./i18n.ts";

export interface FooterLink {
  detail?: string;
  external: boolean;
  href: string;
  icon: string;
  id: "email" | "github" | "linkedin" | "resume" | "rss";
  label: string;
  tone: ContactTone;
  type?: string;
}

const order = ["github", "linkedin", "email"] as const;

export const footerLinks = (
  contact: ContactSource,
  rss: boolean
): FooterLink[] => {
  const entries = contactEntries(contact);
  const contacts = order.flatMap((id): ContactEntry[] =>
    entries.filter((entry) => entry.id === id)
  );
  return [
    ...contacts,
    {
      external: false,
      href: "/resume.pdf",
      icon: "lucide:file-text",
      id: "resume",
      label: en.card.resume,
      tone: "blue",
    },
    ...(rss
      ? [
          {
            detail: en.footer.rssDetail,
            external: false,
            href: "/blog/feed.xml",
            icon: "lucide:rss",
            id: "rss",
            label: en.blog.rssShort,
            tone: "gold",
            type: "application/rss+xml",
          } satisfies FooterLink,
        ]
      : []),
  ];
};
