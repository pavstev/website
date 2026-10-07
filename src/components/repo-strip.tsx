import type { CSSProperties, ReactElement } from "react";

import type { Repo } from "@/lib/github";

import { Icon } from "@/components/icon";
import { en } from "@/lib/i18n";
import { personalData } from "@/lib/personal";
import { languageColor } from "@/lib/theme";

const plural = new Intl.PluralRules("en");

const newTabId = "repos-new-tab";
const firstRow = 2;

const planetKinds = ["ring", "bands", "moon", "craters"] as const;
const countLabel = (count: number): string =>
  (plural.select(count) === "one"
    ? en.repos.countOne
    : en.repos.countOther
  ).replace("{count}", () => String(count));

const tone = (language?: string): CSSProperties | undefined => {
  const color = languageColor(language);
  return color ? ({ "--lang": color } as CSSProperties) : undefined;
};

const seedOf = (text: string): number => {
  let seed = 2_166_136_261;
  for (const char of text) {
    seed = Math.imul(seed ^ (char.codePointAt(0) ?? 0), 16_777_619);
  }
  return seed >>> 0;
};

const planetStyle = (name: string): CSSProperties => {
  const seed = seedOf(name);
  const tilt = (seed % 81) - 40;
  const size = 10 + ((seed >>> 8) % 5);
  return {
    "--p-size": `${String(size)}rem`,
    "--p-tilt": `${String(tilt)}deg`,
  } as CSSProperties;
};

interface RepoStripProps {
  repos: Repo[];
}

export const RepoStrip = ({ repos }: RepoStripProps): null | ReactElement => {
  if (repos.length === 0) return null;
  const overflow = repos.length > firstRow;
  return (
    <section
      aria-labelledby="repos-heading"
      className="fade-up mt-(--card-gap-repos) flex w-full min-w-0 flex-col gap-(--card-gap-strip) text-left delay-3"
      data-repo-overflow={overflow ? "" : undefined}
      data-repos=""
    >
      <span hidden id={newTabId}>
        {en.repos.newTab}
      </span>
      <div className="repo-head text-halo">
        <h2 className="repo-heading" id="repos-heading">
          <span className="type-eyebrow">{en.repos.heading}</span>
          <span aria-hidden="true" className="repo-count">
            <span className="repo-count-all">{repos.length}</span>
            {overflow ? (
              <span className="repo-count-row">{firstRow}</span>
            ) : null}
          </span>
          <span className="sr-only">
            <span className="repo-count-all">{countLabel(repos.length)}</span>
            {overflow ? (
              <span className="repo-count-row">{countLabel(firstRow)}</span>
            ) : null}
          </span>
        </h2>
        <span aria-hidden="true" className="repo-rule" />
        <a
          aria-describedby={newTabId}
          className="repo-all focus-ring"
          href={personalData.github}
          rel="noopener noreferrer"
          target="_blank"
        >
          {en.repos.viewAll}
          <Icon
            aria-hidden
            className="repo-all-arrow"
            name="lucide:arrow-up-right"
            size="0.95em"
          />
        </a>
      </div>
      <ul className="repo-grid">
        {repos.map((repo, index) => (
          <li className="min-w-0" key={repo.url}>
            <a
              aria-describedby={newTabId}
              className="repo-tile"
              data-pointer-light=""
              href={repo.url}
              rel="noopener noreferrer"
              style={tone(repo.language)}
              target="_blank"
            >
              <span
                aria-hidden="true"
                className="repo-planet"
                data-kind={planetKinds[index % planetKinds.length]}
                style={planetStyle(repo.name)}
              />
              <span className="repo-top">
                <span className="repo-name">{repo.name}</span>
                <span aria-hidden="true" className="repo-arrow">
                  <Icon name="lucide:arrow-up-right" size="1rem" />
                </span>
              </span>
              <span className="repo-desc">{repo.description}</span>
              {repo.topics.length > 0 ? (
                <span className="repo-topics">
                  {repo.topics.map((topic) => (
                    <span className="repo-topic" key={topic}>
                      {topic}
                    </span>
                  ))}
                </span>
              ) : null}
              <span className="repo-meta">
                {repo.language ? (
                  <span className="repo-fact repo-language">
                    <span aria-hidden="true" className="repo-dot" />
                    <span className="repo-language-name">{repo.language}</span>
                  </span>
                ) : null}
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
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
};
