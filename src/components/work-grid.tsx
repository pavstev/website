import type { CSSProperties, ReactElement, ReactNode } from "react";

import type { Repo, RepoLanguage } from "@/lib/github";

import { CompoundText } from "@/components/compound-text";
import { Icon } from "@/components/icon";
import { ProductMark } from "@/components/product-mark";
import { RepoTags } from "@/components/repo-tags";
import { StoryMark } from "@/components/story-mark";
import { SelectMenu } from "@/components/ui/select-menu";
import { en } from "@/lib/i18n";
import { type Product, productHost, productMeta } from "@/lib/products";
import { fillText } from "@/lib/template";
import {
  defaultWorkView,
  type StoryEntry,
  storyEntry,
  updatedTime,
  type WorkGroup,
  type WorkSort,
  workSorts,
} from "@/lib/work";

const mainLanguage = (repo: Repo): RepoLanguage | undefined =>
  repo.languages.find(({ name }) => name === repo.language) ??
  repo.languages[0] ??
  (repo.language ? { name: repo.language } : undefined);

const tone = (repo: Repo): CSSProperties | undefined => {
  const color = mainLanguage(repo)?.color;
  return color ? ({ "--lang": color } as CSSProperties) : undefined;
};

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

const SiteKey = ({
  newTabId,
  product,
}: {
  newTabId: string;
  product: Product;
}): ReactElement => (
  <a
    aria-describedby={newTabId}
    className="work-story-link work-site-link keycap-host focus-ring"
    href={product.url}
    rel="noopener noreferrer"
    target="_blank"
  >
    <span className="keycap">
      <span className="work-story-link-label">{productHost(product)}</span>
      <Icon
        aria-hidden
        className="work-story-link-arrow"
        name="lucide:arrow-up-right"
        size="0.875rem"
      />
    </span>
  </a>
);

interface CardShellProps {
  body: ReactNode;
  featured: number;
  foot: ReactNode;
  group: WorkGroup;
  name: string;
  newTabId: string;
  stars: number;
  storyPath?: string | undefined;
  style?: CSSProperties | undefined;
  tools: ReactNode;
  updated: number;
  url: string;
}

const CardShell = ({
  body,
  featured,
  foot,
  group,
  name,
  newTabId,
  stars,
  storyPath,
  style,
  tools,
  updated,
  url,
}: CardShellProps): ReactElement => (
  <li
    className="post-row work-card mat-panel"
    data-featured={featured}
    data-group={group}
    data-name={name}
    data-stars={stars}
    data-story-path={storyPath}
    data-updated={updated}
    style={style}
  >
    <div className="work-card-head">
      <div className="work-card-title">
        <h2 className="post-row-title work-card-name">
          <a
            aria-describedby={newTabId}
            className="work-card-link focus-ring"
            href={url}
            rel="noopener noreferrer"
            target="_blank"
          >
            <span className="story-morph-name">{name}</span>
          </a>
        </h2>
        <p className="work-card-kind">
          {group === "products" ? en.work.kindProduct : en.work.kindOpenSource}
        </p>
      </div>
      <div className="work-card-tools">{tools}</div>
    </div>
    <div className="work-card-body">{body}</div>
    {foot}
  </li>
);

const ProductCard = ({
  featured,
  newTabId,
  product,
}: {
  featured: number;
  newTabId: string;
  product: Product;
}): ReactElement => (
  <CardShell
    body={
      <>
        <p className="post-row-text">
          <CompoundText text={product.line} />
        </p>
        <p className="work-card-facts">{productMeta(product)}</p>
      </>
    }
    featured={featured}
    foot={<SiteKey newTabId={newTabId} product={product} />}
    group="products"
    name={product.name}
    newTabId={newTabId}
    stars={0}
    style={{ "--lang": product.palette.tint } as CSSProperties}
    tools={<ProductMark productKey={product.key} />}
    updated={0}
    url={product.url}
  />
);

const RepoCard = ({
  featured,
  newTabId,
  repo,
}: {
  featured: number;
  newTabId: string;
  repo: Repo;
}): ReactElement => {
  const story = storyEntry(repo.name);
  return (
    <CardShell
      body={
        <>
          <p className="post-row-text">
            <CompoundText text={repo.description} />
          </p>
          <RepoTags languages={repo.languages} topics={repo.topics} />
        </>
      }
      featured={featured}
      foot={story ? <StoryKey name={repo.name} story={story} /> : null}
      group="open-source"
      name={repo.name}
      newTabId={newTabId}
      stars={repo.stars}
      storyPath={story?.path}
      style={tone(repo)}
      tools={
        <>
          <RepoFacts repo={repo} />
          <GithubKey name={repo.name} newTabId={newTabId} url={repo.url} />
        </>
      }
      updated={updatedTime(repo.pushedAt)}
      url={repo.url}
    />
  );
};

const sortLabels: Record<WorkSort, string> = {
  featured: en.work.sortFeatured,
  name: en.work.sortName,
  stars: en.work.sortStars,
  updated: en.work.sortUpdated,
};

const FilterOption = ({
  checked,
  count,
  label,
  value,
}: {
  checked?: boolean;
  count: number;
  label: string;
  value: string;
}): ReactElement => (
  <label className="work-filter-option">
    <input
      className="work-filter-input sr-only"
      defaultChecked={checked}
      name="work-show"
      type="radio"
      value={value}
    />
    <span className="work-filter-name">{label}</span>
    <span className="work-filter-count tabular">{count}</span>
  </label>
);

const WorkControls = ({
  products,
  repos,
}: {
  products: number;
  repos: number;
}): ReactElement => (
  <div className="work-controls">
    {products > 0 && repos > 0 ? (
      <fieldset className="work-filter">
        <legend className="sr-only">{en.work.filterLabel}</legend>
        <FilterOption
          checked
          count={products + repos}
          label={en.work.filterAll}
          value="all"
        />
        <FilterOption
          count={products}
          label={en.work.filterProducts}
          value="products"
        />
        <FilterOption
          count={repos}
          label={en.work.filterOpenSource}
          value="open-source"
        />
      </fieldset>
    ) : null}
    <SelectMenu
      className="work-sort"
      icon={<Icon name="lucide:arrow-up-down" size="1rem" />}
      id="work-sort"
      items={workSorts.map((sort) => ({
        label: sortLabels[sort],
        value: sort,
      }))}
      label={en.work.sortLabel}
      value={defaultWorkView.sort}
    />
    <p
      aria-live="polite"
      className="sr-only"
      data-work-status=""
      role="status"
    />
  </div>
);

interface WorkGridProps {
  newTabId: string;
  products: readonly Product[];
  repos: readonly Repo[];
}

export const WorkGrid = ({
  newTabId,
  products,
  repos,
}: WorkGridProps): ReactElement =>
  products.length + repos.length > 0 ? (
    <div className="work-view" data-work="">
      <WorkControls products={products.length} repos={repos.length} />
      <ol className="work-grid" data-work-grid="">
        {products.map((product, index) => (
          <ProductCard
            featured={index}
            key={product.url}
            newTabId={newTabId}
            product={product}
          />
        ))}
        {repos.map((repo, index) => (
          <RepoCard
            featured={index}
            key={repo.url}
            newTabId={newTabId}
            repo={repo}
          />
        ))}
      </ol>
    </div>
  ) : (
    <p className="work-empty">{en.work.empty}</p>
  );
