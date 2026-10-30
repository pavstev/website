import { en } from "./i18n.ts";
import { personalData } from "./personal.ts";

export interface ContactEntry {
  detail: string;
  external: boolean;
  href: string;
  icon: string;
  id: "email" | "github" | "linkedin";
  label: string;
  tone: ContactTone;
}

export interface ContactSource {
  email: string;
  linkedin: string;
  linkedinHandle: string;
}

export type ContactTone = "blue" | "gold" | "green" | "purple";

export const contactEntries = (contact: ContactSource): ContactEntry[] => [
  {
    detail: contact.email,
    external: false,
    href: `mailto:${contact.email}`,
    icon: "lucide:mail",
    id: "email",
    label: en.card.email,
    tone: "blue",
  },
  {
    detail: personalData.githubHandle,
    external: true,
    href: personalData.github,
    icon: "simple-icons:github",
    id: "github",
    label: en.card.github,
    tone: "purple",
  },
  {
    detail: contact.linkedinHandle,
    external: true,
    href: contact.linkedin,
    icon: "simple-icons:linkedin",
    id: "linkedin",
    label: en.card.linkedin,
    tone: "green",
  },
];
