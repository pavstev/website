import type { ProfileInput } from "./types.ts";

import { buildBadges } from "./icons.ts";
import { escapeMarkdown, escapeXml } from "./text.ts";

const paragraph = (content: string): string[] => [
  `<p align="center">`,
  `  ${content}`,
  `</p>`,
  ``,
];

const summaryLine = (input: ProfileInput): string => {
  const { personal } = input;
  const [before = "", ...rest] = personal.summary.split(personal.city);
  if (rest.length === 0) {
    throw new Error(`Summary does not mention "${personal.city}"`);
  }
  const after = rest.join(personal.city);
  const flag = `<img src="assets/flag-at.svg" height="14" alt="${escapeXml(personal.country)}">`;
  return `${escapeXml(before)}${escapeXml(personal.city)} ${flag}${escapeXml(after)}`;
};

export const renderReadme = (input: ProfileInput): string => {
  const { personal, repos, strings } = input;
  const header = `<a href="${escapeXml(personal.website)}"><img src="assets/header.svg" alt="${escapeXml(`${personal.name}, ${personal.title}`)}"></a>`;
  const badges = buildBadges(input)
    .map(
      (badge) =>
        `<a href="${escapeXml(badge.href)}"><img src="${badge.file}" width="40" height="40" alt="${escapeXml(badge.alt)}"></a>`
    )
    .join("&nbsp;\n  ");
  const projects = repos.map(
    (repo) =>
      `- **[${escapeMarkdown(repo.name)}](${repo.url})** · ${escapeMarkdown(repo.description)}`
  );
  return `${[
    `<!-- ${strings.profile.generated} -->`,
    ...paragraph(header),
    ...paragraph(summaryLine(input)),
    ...paragraph(badges),
    `## ${strings.repos.heading}`,
    ``,
    ...projects,
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
