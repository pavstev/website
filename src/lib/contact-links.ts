import type { Blocker } from "@/lib/tip-place";

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

export const contactAvoid = (): Blocker[] => [
  ...[
    ...document.querySelectorAll(
      ".contact-row :is(.download-pill, .contact-link)"
    ),
  ].map((element) => ({ box: element.getBoundingClientRect(), weight: 2 })),
  ...[...document.querySelectorAll(".section-link")].map((element) => ({
    box: element.getBoundingClientRect(),
    weight: 1,
  })),
  ...[...document.querySelectorAll("[data-card] > [data-blur-in]")].map(
    (element) => ({ box: element.getBoundingClientRect(), weight: 3 })
  ),
];

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
