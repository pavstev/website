import type { CSSProperties, ReactElement } from "react";

import type { Repo } from "@/lib/github";

import { CompoundText } from "@/components/compound-text";
import { Icon } from "@/components/icon";
import { RepoTags } from "@/components/repo-tags";
import { en } from "@/lib/i18n";

const plural = new Intl.PluralRules("en");

const planetKinds = ["ring", "bands", "moon", "craters"] as const;

const headingFor = (count: number): string =>
  (plural.select(count) === "one"
    ? en.repos.headingOne
    : en.repos.headingOther
  ).replace("{count}", () => String(count));

const tone = (repo: Repo): CSSProperties | undefined => {
  const color = (
    repo.languages.find(({ name }) => name === repo.language) ??
    repo.languages[0]
  )?.color;
  return color ? ({ "--lang": color } as CSSProperties) : undefined;
};

const seedOf = (text: string): number => {
  let seed = 2_166_136_261;
  for (const char of text) {
    seed = Math.imul(seed ^ (char.codePointAt(0) ?? 0), 16_777_619);
  }
  return seed >>> 0;
};

const planetStyle = (name: string): CSSProperties =>
  ({ "--p-tilt": `${String((seedOf(name) % 81) - 40)}deg` }) as CSSProperties;

interface RepoStripProps {
  newTabId: string;
  repos: Repo[];
}

export const RepoStrip = ({
  newTabId,
  repos,
}: RepoStripProps): null | ReactElement => {
  if (repos.length === 0) return null;
  return (
    <section aria-labelledby="repos-heading" className="strip" data-repos="">
      <div className="repo-head text-halo">
        <h2 className="repo-heading type-eyebrow" id="repos-heading">
          {headingFor(repos.length)}
        </h2>
        <span aria-hidden="true" className="repo-rule" />
      </div>
      <ul className="repo-grid">
        {repos.map((repo, index) => (
          <li className="min-w-0" key={repo.url}>
            <div className="repo-tile" data-pointer-light="" style={tone(repo)}>
              <span
                aria-hidden="true"
                className="repo-planet"
                data-kind={planetKinds[index % planetKinds.length]}
                style={planetStyle(repo.name)}
              />
              <div className="repo-body">
                <div className="repo-top">
                  <a
                    aria-describedby={newTabId}
                    className="repo-name repo-link"
                    href={repo.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {repo.name}
                  </a>
                  <RepoTags
                    id={`repo-tags-${String(index)}`}
                    languages={repo.languages}
                    name={repo.name}
                    topics={repo.topics}
                  />
                  {repo.stars > 0 || repo.forks > 0 ? (
                    <span className="repo-meta">
                      {repo.stars > 0 ? (
                        <span className="repo-fact">
                          <Icon
                            aria-hidden
                            name="lucide:star"
                            size="0.875rem"
                          />
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
                <p className="repo-desc">
                  <CompoundText text={repo.description} />
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};
