import type { CSSProperties, ReactElement } from "react";

import type { Repo, RepoLanguage } from "@/lib/github";

import { CompoundText } from "@/components/compound-text";
import { Icon } from "@/components/icon";
import { RepoTags } from "@/components/repo-tags";
import { StoryMark } from "@/components/story-mark";
import { en } from "@/lib/i18n";
import { fillText } from "@/lib/template";
import { type StoryEntry, storyEntry } from "@/lib/work";

const mainLanguage = (repo: Repo): RepoLanguage | undefined =>
  repo.languages.find(({ name }) => name === repo.language) ??
  repo.languages[0] ??
  (repo.language ? { name: repo.language } : undefined);

const tone = (repo: Repo): CSSProperties | undefined => {
  const color = mainLanguage(repo)?.color;
  return color ? ({ "--lang": color } as CSSProperties) : undefined;
};

const cardRows = (count: number): CSSProperties =>
  Object.fromEntries(
    [1, 2, 3, 4].map((columns) => [
      `--rows-${String(columns)}`,
      String(Math.ceil(count / columns)),
    ])
  );

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

const RepoActions = ({
  name,
  newTabId,
  story,
  url,
}: {
  name: string;
  newTabId: string;
  story: StoryEntry | undefined;
  url: string;
}): ReactElement => (
  <div className="work-card-actions">
    <a
      aria-describedby={newTabId}
      aria-label={fillText(en.repos.viewOnGithubLabel, { name })}
      className="work-card-action focus-ring"
      href={url}
      rel="noopener noreferrer"
      target="_blank"
    >
      <span className="work-card-action-label">{en.repos.viewOnGithub}</span>
      <Icon aria-hidden name="lucide:arrow-up-right" size="0.875rem" />
    </a>
    {story ? (
      <a
        aria-label={fillText(en.repos.seeStoryLabel, { name })}
        className="work-story-link focus-ring"
        data-story-link=""
        href={story.path}
      >
        <StoryMark kind={story.key} />
        <span className="work-story-link-label">{en.repos.seeStory}</span>
        <Icon
          aria-hidden
          className="work-story-link-arrow"
          name="lucide:arrow-right"
          size="0.875rem"
        />
      </a>
    ) : null}
  </div>
);

const RepoCard = ({ newTabId, repo }: RepoProps): ReactElement => {
  const story = storyEntry(repo.name);
  return (
    <li
      className="post-row work-card mat-panel"
      data-story-path={story?.path}
      style={tone(repo)}
    >
      <div className="work-card-head">
        <h3 className="post-row-title work-card-name">
          <a
            aria-describedby={newTabId}
            className="work-card-link focus-ring"
            href={repo.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            <span className="story-morph-name">{repo.name}</span>
          </a>
        </h3>
        <RepoFacts repo={repo} />
      </div>
      <p className="post-row-text">
        <CompoundText text={repo.description} />
      </p>
      <RepoTags
        id={`tech-${repo.name}`}
        languages={repo.languages}
        topics={repo.topics}
      />
      <RepoActions
        name={repo.name}
        newTabId={newTabId}
        story={story}
        url={repo.url}
      />
    </li>
  );
};

const AllRepos = ({ href }: { href: string }): ReactElement => (
  <li className="work-all-cell">
    <a
      className="work-all focus-ring"
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      <Icon
        aria-hidden
        className="work-all-mark"
        name="simple-icons:github"
        size="1.25rem"
      />
      <span className="work-all-text">
        {en.repos.all}
        <Icon aria-hidden name="lucide:arrow-up-right" size="0.875rem" />
      </span>
      <span className="sr-only"> {en.card.newTab}</span>
    </a>
  </li>
);

interface RepoStripProps {
  allHref: string;
  newTabId: string;
  repos: Repo[];
}

export const RepoStrip = ({
  allHref,
  newTabId,
  repos,
}: RepoStripProps): ReactElement => (
  <ol className="work-repos" data-repos="" style={cardRows(repos.length)}>
    {repos.map((repo) => (
      <RepoCard key={repo.url} newTabId={newTabId} repo={repo} />
    ))}
    <AllRepos href={allHref} />
  </ol>
);
