import type { CSSProperties, ReactElement } from "react";

import type { Repo, RepoLanguage } from "@/lib/github";

import { CompoundText } from "@/components/compound-text";
import { Icon } from "@/components/icon";
import { RepoTags } from "@/components/repo-tags";
import { en } from "@/lib/i18n";
import { storyPath } from "@/lib/work";

const mainLanguage = (repo: Repo): RepoLanguage | undefined =>
  repo.languages.find(({ name }) => name === repo.language) ??
  repo.languages[0] ??
  (repo.language ? { name: repo.language } : undefined);

const tone = (repo: Repo): CSSProperties | undefined => {
  const color = mainLanguage(repo)?.color;
  return color ? ({ "--lang": color } as CSSProperties) : undefined;
};

interface RepoProps {
  newTabId: string;
  repo: Repo;
}

const RepoFacts = ({ repo }: { repo: Repo }): null | ReactElement =>
  repo.stars > 0 || repo.forks > 0 ? (
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
          <Icon aria-hidden name="lucide:git-fork" size="0.875rem" />
          <span className="tabular">{repo.forks}</span>
          <span className="sr-only">{en.repos.forksLabel}</span>
        </span>
      ) : null}
    </span>
  ) : null;

const RepoCard = ({ newTabId, repo }: RepoProps): ReactElement => {
  const story = storyPath(repo.name);
  return (
    <li
      className="post-row work-card mat-panel"
      data-story-path={story}
      style={tone(repo)}
    >
      <div className="work-card-head">
        <h3 className="post-row-title work-card-name">
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
        <span className="work-card-side">
          <RepoFacts repo={repo} />
          <Icon
            aria-hidden
            className="work-card-mark"
            name="lucide:arrow-up-right"
            size="1rem"
          />
        </span>
      </div>
      <p className="post-row-text">
        <CompoundText text={repo.description} />
      </p>
      <RepoTags
        id={`tech-${repo.name}`}
        languages={repo.languages}
        topics={repo.topics}
      />
      {story ? (
        <a className="work-card-story focus-ring" href={story}>
          {en.repos.seeStory}
          <Icon aria-hidden name="lucide:arrow-right" size="0.875rem" />
        </a>
      ) : null}
    </li>
  );
};

interface RepoStripProps {
  newTabId: string;
  repos: Repo[];
}

export const RepoStrip = ({
  newTabId,
  repos,
}: RepoStripProps): ReactElement => (
  <ol className="work-repos" data-repos="">
    {repos.map((repo) => (
      <RepoCard key={repo.url} newTabId={newTabId} repo={repo} />
    ))}
  </ol>
);
