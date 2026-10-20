import type { ProfileInput, ProfileProduct } from "./types.ts";

import { type Repo } from "../lib/github.ts";
import { escapeMarkdown } from "./text.ts";

const maxLanguages = 3;

export const resumeUrl = (website: string): string =>
  new URL("/resume.pdf", website).href;

const table = (
  head: readonly string[],
  rows: readonly string[][]
): string[] => [
  `| ${head.join(" | ")} |`,
  `| ${head.map(() => ":--").join(" | ")} |`,
  ...rows.map((row) => `| ${row.join(" | ")} |`),
];

const productRow = (product: ProfileProduct): string[] => [
  `**[${escapeMarkdown(product.name)}](${product.url})**`,
  escapeMarkdown(product.meta),
  escapeMarkdown(product.line),
];

const repoRow = (repo: Repo, withStars: boolean): string[] => [
  `**[${escapeMarkdown(repo.name)}](${repo.url})**`,
  repo.languages
    .slice(0, maxLanguages)
    .map(({ name }) => escapeMarkdown(name))
    .join(" · "),
  ...(withStars ? [repo.stars > 0 ? `★ ${String(repo.stars)}` : ""] : []),
  escapeMarkdown(repo.description),
];

export const renderReadme = (input: ProfileInput): string => {
  const { personal, products, repos, strings } = input;
  const { profile, work } = strings;
  const links = [
    `[${profile.website}](${personal.website})`,
    `[${strings.card.linkedin}](${personal.linkedin})`,
    `[${profile.resume}](${resumeUrl(personal.website)})`,
  ].join(" · ");
  const productSection =
    products.length > 0
      ? [
          ``,
          `## ${work.productsHeading}`,
          ``,
          ...table(
            [profile.columnProduct, profile.columnRole, profile.columnWhat],
            products.map((product) => productRow(product))
          ),
        ]
      : [];
  const withStars = repos.some((repo) => repo.stars > 0);
  const projectSection =
    repos.length > 0
      ? [
          ``,
          `## ${work.projectsHeading}`,
          ``,
          ...table(
            [
              profile.columnProject,
              profile.columnBuiltWith,
              ...(withStars ? [profile.columnStars] : []),
              profile.columnWhat,
            ],
            repos.map((repo) => repoRow(repo, withStars))
          ),
        ]
      : [];
  return `${[
    `<!-- ${profile.generated} -->`,
    `# ${escapeMarkdown(personal.name)}`,
    ``,
    `**${escapeMarkdown(personal.title)}**`,
    ``,
    escapeMarkdown(personal.summary),
    ``,
    links,
    ...productSection,
    ...projectSection,
  ].join("\n")}\n`;
};

export const renderContributing = (input: ProfileInput): string => {
  const { profile } = input.strings;
  return `${[
    `<!-- ${profile.generated} -->`,
    `# ${profile.contributingTitle}`,
    ``,
    profile.contributingIntro,
    ``,
    profile.contributingSource,
    ``,
    `- ${profile.contributingContent}`,
    `- ${profile.contributingStrings}`,
    `- ${profile.contributingLayout}`,
    ``,
    profile.contributingPreview,
  ].join("\n")}\n`;
};
