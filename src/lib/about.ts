import { roadLines } from "../data/about-road.ts";
import { type Cv } from "./cv.ts";
import { en } from "./i18n.ts";
import { formatPeriod, industries, isOngoing } from "./industries.ts";

export interface RoadItem {
  company: string;
  line: string;
  now: boolean;
  position: string;
  years: string;
}

const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const monthOf = (label: string): number => {
  const index = months.indexOf(label.slice(0, 3));
  if (index === -1) throw new Error(`about: "${label}" has no month`);
  return index;
};

export const yearsOfCode = (cv: Cv): number => {
  const first = cv.experience.items.at(-1);
  if (first === undefined) throw new Error("about: the CV has no experience");
  const at = new Date(cv.updatedAt);
  const start = Number(first.from.slice(-4));
  const years = at.getUTCFullYear() - start;
  return at.getUTCMonth() < monthOf(first.from) ? years - 1 : years;
};

export const aboutFacts = (cv: Cv): string[] => [
  en.about.facts.years.replace("{n}", () => String(yearsOfCode(cv))),
  industries.map((industry) => industry.word).join(en.industries.separator),
  en.about.facts.agents,
];

export const aboutRoad = (cv: Cv): RoadItem[] => {
  const seen = new Set<string>();
  const items = cv.experience.items.map((item) => {
    const line = roadLines[item.company];
    if (line === undefined) {
      throw new Error(`about road: no line for ${item.company}`);
    }
    seen.add(item.company);
    const years = formatPeriod(item.from, item.to);
    return {
      company: item.company,
      line,
      now: isOngoing(item.to),
      position: item.position,
      years,
    };
  });
  for (const company of Object.keys(roadLines)) {
    if (!seen.has(company)) {
      throw new Error(`about road: ${company} is not in the CV`);
    }
  }
  return items;
};
