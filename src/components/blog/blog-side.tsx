import type { ReactElement } from "react";

import { AuthorPhoto } from "@/components/blog/author-photo";
import { Icon } from "@/components/icon";
import { getContact } from "@/lib/github";
import { en } from "@/lib/i18n";
import { personalData } from "@/lib/personal";

export const BlogSide = async (): Promise<ReactElement> => {
  const contact = await getContact(personalData.githubHandle);
  const links = [
    {
      external: true,
      href: personalData.github,
      icon: "simple-icons:github",
      label: en.card.github,
    },
    {
      external: true,
      href: contact.linkedin,
      icon: "simple-icons:linkedin",
      label: en.card.linkedin,
    },
    {
      external: false,
      href: `mailto:${contact.email}`,
      icon: "lucide:mail",
      label: en.card.email,
    },
    {
      external: false,
      href: "/resume.pdf",
      icon: "lucide:download",
      label: en.card.resume,
    },
  ];
  return (
    <aside aria-label={en.blog.sideLabel} className="blog-side">
      <AuthorPhoto
        alt={en.card.portraitAlt}
        className="blog-side-photo"
        sizes="6rem"
      />
      <p className="blog-side-name">{personalData.name}</p>
      <p className="blog-side-role">{en.blog.sideRole}</p>
      <ul className="blog-side-links">
        {links.map((link) => (
          <li key={link.label}>
            <a
              className="blog-side-link focus-ring"
              href={link.href}
              rel={link.external ? "me noopener noreferrer" : undefined}
              target={link.external ? "_blank" : undefined}
            >
              <Icon name={link.icon} size="1rem" />
              <span>{link.label}</span>
              {link.external && (
                <span className="sr-only"> {en.card.newTab}</span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
};
