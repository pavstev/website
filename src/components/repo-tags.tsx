import type { ReactElement } from "react";

import { TechTag } from "@/components/tech-tag";
import { type RepoLanguage } from "@/lib/github";
import { en } from "@/lib/i18n";
import { techTags } from "@/lib/tech-logos";

interface RepoTagsProps {
  id: string;
  languages: RepoLanguage[];
  topics: string[];
}

export const RepoTags = ({
  id,
  languages,
  topics,
}: RepoTagsProps): null | ReactElement => {
  const tags = techTags(languages, topics);
  if (tags.length === 0) return null;
  const items = tags.map((tech) => (
    <li key={tech.name}>
      <TechTag tech={tech} />
    </li>
  ));
  return (
    <div className="tech-lane" data-tech-lane="">
      <ul className="tech-tags">{items}</ul>
      <button
        aria-expanded="false"
        className="tech-more focus-ring"
        data-hover-open="pin"
        data-more={en.repos.more}
        data-more-label={en.repos.moreLabel}
        hidden
        popoverTarget={id}
        type="button"
      />
      <div
        className="tech-pop mat-pop"
        data-anchored="always"
        id={id}
        popover="auto"
        role="tooltip"
      >
        <ul className="tech-tags">{items}</ul>
      </div>
    </div>
  );
};
