import { type Cv } from "./cv.ts";
import { en } from "./i18n.ts";

export interface Industry {
  facts: string;
  icon: string;
  key: IndustryKey;
  label: string;
  panelId: string;
  title: string;
  word: string;
}

export interface IndustryJob {
  company: string;
  period: string;
  site: string;
}

type IndustryKey = keyof typeof en.industries.topics;

const industryIcons = {
  betting: "lucide:dices",
  fintech: "lucide:landmark",
  fleet: "lucide:truck",
  healthtech: "lucide:heart-pulse",
} as const satisfies Record<IndustryKey, string>;

export const industryCompanies = {
  betting: "167Pluto",
  fintech: "Pannovate",
  fleet: "Safety Real Time",
  healthtech: "Evermed",
} as const satisfies Record<IndustryKey, string>;

const industryFallbackSites: Partial<Record<IndustryKey, string>> = {
  betting: "https://www.linkedin.com/company/167pluto/",
};

const industryKeys = [
  "fintech",
  "betting",
  "healthtech",
  "fleet",
] as const satisfies readonly IndustryKey[];

export const industries: readonly Industry[] = industryKeys.map((key) => {
  const topic = en.industries.topics[key];
  return {
    ...topic,
    icon: industryIcons[key],
    key,
    label: en.industries.label.replace("{topic}", () => topic.word),
    panelId: `industry-${key}`,
  };
});

const yearPattern = /(?<!\d)\d{4}(?!\d)/g;

const ongoingPattern = /\b(?:present|now|current)\b/i;

const yearOf = (value: string): number | undefined => {
  const year = value.match(yearPattern)?.at(-1);
  return year === undefined ? undefined : Number(year);
};

const isOngoing = (to: string): boolean =>
  ongoingPattern.test(to) || yearOf(to) === undefined;

export const formatPeriod = (from: string, to: string): string => {
  const start = yearOf(from);
  if (start === undefined) {
    throw new Error(`industries: "${from}" has no start year`);
  }
  const end = isOngoing(to) ? undefined : yearOf(to);
  if (end === undefined) {
    return en.industries.since.replace("{year}", () => String(start));
  }
  return end === start
    ? String(start)
    : en.industries.range
        .replace("{from}", () => String(start))
        .replace("{to}", () => String(end));
};

const compact = (value: string): string =>
  value.replaceAll(/\s+/g, "").toLowerCase();

const webLink = (value: string): string => {
  const link = value.trim();
  if (!/^https?:\/\//i.test(link) || !URL.canParse(link)) {
    return "";
  }
  return new URL(link).hostname === "" ? "" : link;
};

type Stint = Cv["experience"]["items"][number];

const startYear = (stint: Stint): number =>
  yearOf(stint.from) ?? Number.MAX_SAFE_INTEGER;

const endYear = (stint: Stint): number =>
  isOngoing(stint.to) ? Number.MAX_SAFE_INTEGER : (yearOf(stint.to) ?? 0);

export const industryJob = (cv: Cv, key: IndustryKey): IndustryJob => {
  const target = industryCompanies[key];
  const stints = cv.experience.items.filter(
    (item) => compact(item.company) === compact(target)
  );
  const [earliest] = stints.toSorted((a, b) => startYear(a) - startYear(b));
  const [latest] = stints.toSorted((a, b) => endYear(b) - endYear(a));
  if (earliest === undefined || latest === undefined) {
    throw new Error(`industries: ${target} is not in the CV feed`);
  }
  return {
    company: latest.company,
    period: formatPeriod(earliest.from, latest.to),
    site:
      stints
        .map((stint) => webLink(stint.websiteUrl))
        .find((link) => link !== "") ??
      industryFallbackSites[key] ??
      "",
  };
};
