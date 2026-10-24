import type { ReactElement } from "react";

import { TechTag } from "@/components/tech-tag";
import { type RepoLanguage } from "@/lib/github";
import { techTags } from "@/lib/tech-logos";

interface RepoTagsProps {
  languages: RepoLanguage[];
  topics: string[];
}

export const RepoTags = ({
  languages,
  topics,
}: RepoTagsProps): null | ReactElement => {
  const tags = techTags(languages, topics);
  if (tags.length === 0) return null;
  return (
    <ul className="tech-tags">
      {tags.map((tech) => (
        <li key={tech.name}>
          <TechTag tech={tech} />
        </li>
      ))}
    </ul>
  );
};
