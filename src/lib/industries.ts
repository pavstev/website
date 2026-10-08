import { en } from "@/lib/i18n";

export interface Industry {
  company: string;
  facts: string;
  icon: string;
  key: IndustryKey;
  label: string;
  panelId: string;
  period: string;
  site: string;
  title: string;
  word: string;
}

type IndustryKey = keyof typeof en.industries.topics;

const industryIcons = {
  betting: "lucide:dices",
  fintech: "lucide:landmark",
  fleet: "lucide:truck",
  healthtech: "lucide:heart-pulse",
} as const satisfies Record<IndustryKey, string>;

const companySites = {
  betting: "https://www.linkedin.com/company/167pluto/",
  fintech: "https://pannovate.com/",
  fleet: "https://safetyrealtime.com/",
  healthtech: "https://evermedtv.com/",
} as const satisfies Record<IndustryKey, string>;

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
    site: companySites[key],
  };
});
