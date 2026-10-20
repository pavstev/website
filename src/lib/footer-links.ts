import { en } from "./i18n.ts";
import { personalData } from "./personal.ts";

export interface FooterLink {
  external: boolean;
  href: string;
  icon: string;
  id: string;
  label: string;
  type?: string;
}

export const footerLinks = (
  contact: { email: string; linkedin: string },
  rss: boolean
): FooterLink[] => [
  {
    external: true,
    href: personalData.github,
    icon: "simple-icons:github",
    id: "github",
    label: en.card.github,
  },
  {
    external: true,
    href: contact.linkedin,
    icon: "simple-icons:linkedin",
    id: "linkedin",
    label: en.card.linkedin,
  },
  {
    external: false,
    href: `mailto:${contact.email}`,
    icon: "lucide:mail",
    id: "email",
    label: en.card.email,
  },
  {
    external: false,
    href: "/resume.pdf",
    icon: "lucide:file-text",
    id: "resume",
    label: en.card.resume,
  },
  ...(rss
    ? [
        {
          external: false,
          href: "/blog/feed.xml",
          icon: "lucide:rss",
          id: "rss",
          label: en.blog.rssShort,
          type: "application/rss+xml",
        },
      ]
    : []),
];
