import { type Cv } from "./cv.ts";
import { en } from "./i18n.ts";

const oneLine = (value: string): string => value.replaceAll(/\s+/g, " ").trim();

const joined = (parts: string[], separator: string): string =>
  parts
    .map((part) => oneLine(part))
    .filter(Boolean)
    .join(separator);

const span = (from: string, to: string): string => {
  const years = joined([from, to], " to ");
  return years ? ` (${years})` : "";
};

const withOverview = (head: string, overview: string): string => {
  const detail = oneLine(overview);
  return detail ? `${head}: ${detail}` : head;
};

const section = (heading: string, lines: string[]): string[] =>
  lines.length > 0 ? [`## ${heading}`, "", ...lines, ""] : [];

const experienceLines = (cv: Cv): string[] =>
  cv.experience.items
    .filter((role) => joined([role.position, role.company], ""))
    .map((role) =>
      withOverview(
        `- ${joined([role.position, role.company], " at ")}${span(role.from, role.to)}`,
        role.overview
      )
    );

const skillLines = (cv: Cv): string[] =>
  cv.skills.items
    .map((group) => ({
      keywords: joined(group.keywords, ", "),
      name: oneLine(group.name),
    }))
    .filter((group) => group.keywords)
    .map(({ keywords, name }) =>
      name ? `- ${name}: ${keywords}` : `- ${keywords}`
    );

const educationLines = (cv: Cv): string[] =>
  cv.education.items
    .filter((item) => joined([item.degree, item.school, item.area], ""))
    .map((item) => {
      const study = joined([item.degree, item.area], ", ");
      return `- ${joined([study, item.school], " at ")}${span(item.from, item.to)}`;
    });

const projectLines = (cv: Cv): string[] =>
  cv.projects.items
    .filter((project) => oneLine(project.name))
    .map((project) => {
      const name = oneLine(project.name);
      const link = project.websiteUrl.trim();
      return withOverview(
        link ? `- [${name}](${link})` : `- ${name}`,
        project.overview
      );
    });

export const cvLlmsSections = (cv: Cv): string[] => [
  ...section(en.llms.experience, experienceLines(cv)),
  ...section(en.llms.skills, skillLines(cv)),
  ...section(en.llms.education, educationLines(cv)),
  ...section(en.llms.cvProjects, projectLines(cv)),
];
