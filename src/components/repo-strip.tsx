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

const GithubKey = ({
  name,
  newTabId,
  url,
}: {
  name: string;
  newTabId: string;
  url: string;
}): ReactElement => (
  <span className="repo-key" data-repo-key="">
    <a
      aria-describedby={newTabId}
      aria-label={fillText(en.repos.viewOnGithubLabel, { name })}
      className="repo-key-link focus-ring"
      href={url}
      rel="noopener noreferrer"
      target="_blank"
    >
      <Icon
        aria-hidden
        className="repo-key-mark"
        name="simple-icons:github"
        size="1.3em"
      />
    </a>
    <span className="repo-tip tip" role="tooltip">
      <span aria-hidden className="tip-surface" />
      <span className="tip-body">{en.repos.viewOnGithub}</span>
    </span>
  </span>
);

const StoryKey = ({
  name,
  story,
}: {
  name: string;
  story: StoryEntry;
}): ReactElement => (
  <a
    aria-label={fillText(en.repos.seeStoryLabel, { name })}
    className="work-story-link keycap-host focus-ring"
    data-story-link=""
    href={story.path}
  >
    <span className="keycap">
      <span className="work-story-link-lead">
        <StoryMark kind={story.key} />
        <span className="work-story-link-label">{en.repos.seeStory}</span>
      </span>
      <Icon
        aria-hidden
        className="work-story-link-arrow"
        name="lucide:arrow-right"
        size="0.875rem"
      />
    </span>
  </a>
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
        <div className="work-card-tools">
          <RepoFacts repo={repo} />
          <GithubKey name={repo.name} newTabId={newTabId} url={repo.url} />
        </div>
      </div>
      <div className="work-card-body">
        <p className="post-row-text">
          <CompoundText text={repo.description} />
        </p>
        <RepoTags languages={repo.languages} topics={repo.topics} />
      </div>
      {story ? <StoryKey name={repo.name} story={story} /> : null}
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
  <ol className="work-repos" data-repos="">
    {repos.map((repo) => (
      <RepoCard key={repo.url} newTabId={newTabId} repo={repo} />
    ))}
    <AllRepos href={allHref} />
  </ol>
);
