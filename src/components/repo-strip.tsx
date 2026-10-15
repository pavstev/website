import type { CSSProperties, ReactElement } from "react";

import type { Repo } from "@/lib/github";

import { CompoundText } from "@/components/compound-text";
import { Icon } from "@/components/icon";
import { RepoTags } from "@/components/repo-tags";
import { en } from "@/lib/i18n";

const tone = (repo: Repo): CSSProperties | undefined => {
  const color = (
    repo.languages.find(({ name }) => name === repo.language) ??
    repo.languages[0]
  )?.color;
  return color ? ({ "--lang": color } as CSSProperties) : undefined;
};

interface RepoStripProps {
  allUrl: string;
  newTabId: string;
  repos: Repo[];
}

export const RepoStrip = ({
  allUrl,
  newTabId,
  repos,
}: RepoStripProps): ReactElement => (
  <>
    <ol className="post-list work-list" data-repos="">
      {repos.map((repo, index) => (
        <li
          className="post-row work-row mat-panel"
          key={repo.url}
          style={tone(repo)}
        >
          <div className="work-row-body">
            <div className="work-row-top">
              <h3 className="post-row-title">
                <a
                  aria-describedby={newTabId}
                  className="post-row-link focus-ring"
                  href={repo.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {repo.name}
                </a>
              </h3>
              {repo.stars > 0 || repo.forks > 0 ? (
                <span className="repo-meta">
                  {repo.stars > 0 ? (
                    <span className="repo-fact">
                      <Icon aria-hidden name="lucide:star" size="0.875rem" />
                      <span className="tabular">{repo.stars}</span>
                      <span className="sr-only">{en.repos.starsLabel}</span>
                    </span>
                  ) : null}
                  {repo.forks > 0 ? (
                    <span className="repo-fact">
                      <Icon
                        aria-hidden
                        name="lucide:git-fork"
                        size="0.875rem"
                      />
                      <span className="tabular">{repo.forks}</span>
                      <span className="sr-only">{en.repos.forksLabel}</span>
                    </span>
                  ) : null}
                </span>
              ) : null}
            </div>
            <RepoTags
              id={`repo-tags-${String(index)}`}
              languages={repo.languages}
              name={repo.name}
              topics={repo.topics}
            />
            <p className="post-row-text">
              <CompoundText text={repo.description} />
            </p>
          </div>
        </li>
      ))}
    </ol>
    <p className="work-more">
      <a
        className="work-more-link mat-cap focus-ring"
        href={allUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        {en.repos.all}
        <span className="sr-only"> {en.card.newTab}</span>
      </a>
    </p>
  </>
);
