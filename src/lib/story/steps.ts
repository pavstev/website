import { stepCopy } from "../../data/dotfiles-story.ts";
import { type DotfilesFacts } from "../dotfiles-facts.ts";
import { type StepId, stepOrder } from "./step-ids.ts";

export interface StoryStep {
  eyebrow: string;
  id: StepId;
  line: string;
  note: string;
  screens: 1 | 1.5;
  strip?: StoryStrip;
  tick: boolean;
}

type StoryStrip =
  { command: string; output: string[] } | { output: string[]; title: string };

const longSteps: ReadonlySet<StepId> = new Set(["c02", "h1", "h2"]);

export const buildSteps = (facts: DotfilesFacts): StoryStep[] => {
  const copy = stepCopy(facts);
  return stepOrder.map((id) => ({
    ...copy[id],
    id,
    screens: longSteps.has(id) ? 1.5 : 1,
    tick: id !== "outro",
  }));
};
