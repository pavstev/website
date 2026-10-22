import {
  skillUsage,
  type SkillUsageData,
  stepCopy,
} from "../../data/dotfiles-story.ts";
import { type DotfilesFacts } from "../dotfiles-facts.ts";
import { type StepId, stepOrder } from "./step-ids.ts";

export interface StoryStep {
  eyebrow: string;
  id: StepId;
  line: string;
  note: string;
  screens: number;
  strip?: StoryStrip;
  tick: boolean;
}

type StoryStrip =
  { command: string; output: string[] } | { output: string[]; title: string };

const longSteps: ReadonlySet<StepId> = new Set(["c02", "h1", "h2"]);

const screensOf = (id: StepId, facts: DotfilesFacts): number => {
  if (id === "skills") return facts.skillNames.length / 2 + 1;
  return longSteps.has(id) ? 1.5 : 1;
};

export const buildSteps = (
  facts: DotfilesFacts,
  usage: SkillUsageData = skillUsage
): StoryStep[] => {
  const copy = stepCopy(facts, usage);
  return stepOrder.map((id) => ({
    ...copy[id],
    id,
    screens: screensOf(id, facts),
    tick: id !== "outro",
  }));
};
