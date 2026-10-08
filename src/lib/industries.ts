import { en } from "@/lib/i18n";

export interface Industry {
  facts: string;
  icon: string;
  key: IndustryKey;
  label: string;
  panelId: string;
  subtitle: string;
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
