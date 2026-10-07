import type { CSSProperties, ReactElement } from "react";

import { type RepoLanguage } from "@/lib/github";
import { en } from "@/lib/i18n";

interface RepoTagsProps {
  id: string;
  languages: RepoLanguage[];
  name: string;
  topics: string[];
}

interface Tag {
  color?: string | undefined;
  kind: "language" | "topic";
  label: string;
}

const shownCount = 2;

const Chip = ({ tag }: { tag: Tag }): ReactElement => (
  <span
    className="repo-chip"
    data-kind={tag.kind}
    style={tag.color ? ({ "--chip": tag.color } as CSSProperties) : undefined}
  >
    {tag.label}
  </span>
);

export const RepoTags = ({
  id,
  languages,
  name,
  topics,
}: RepoTagsProps): null | ReactElement => {
  const languageTags: Tag[] = languages.map(({ color, name: label }) => ({
    color,
    kind: "language",
    label,
  }));
  const topicTags: Tag[] = topics.map((label) => ({ kind: "topic", label }));
  const tags = [...languageTags, ...topicTags];
  if (tags.length === 0) return null;
  const guess = Math.max(0, tags.length - shownCount);
  return (
    <span className="repo-tags">
      <span className="repo-tags-row">
        {tags.map((tag) => (
          <Chip key={`${tag.kind}-${tag.label}`} tag={tag} />
        ))}
      </span>
      {tags.length > 1 ? (
        <>
          <button
            aria-label={en.repos.moreLabel
              .replace("{count}", () => String(guess))
              .replace("{name}", () => name)}
            className="repo-more focus-ring"
            data-hover-open=""
            data-label={en.repos.moreLabel.replace("{name}", () => name)}
            data-text={en.repos.more}
            hidden={guess === 0}
            popoverTarget={id}
            type="button"
          >
            {en.repos.more.replace("{count}", () => String(guess))}
          </button>
          <div
            className="repo-tags-panel"
            data-anchored="always"
            data-placement="bottom-start"
            id={id}
            popover="auto"
          >
            {languageTags.length > 0 ? (
              <>
                <p className="repo-tags-title">{en.repos.languages}</p>
                <span className="repo-tags-list">
                  {languageTags.map((tag) => (
                    <Chip key={tag.label} tag={tag} />
                  ))}
                </span>
              </>
            ) : null}
            {topicTags.length > 0 ? (
              <>
                <p className="repo-tags-title">{en.repos.topics}</p>
                <span className="repo-tags-list">
                  {topicTags.map((tag) => (
                    <Chip key={tag.label} tag={tag} />
                  ))}
                </span>
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </span>
  );
};
