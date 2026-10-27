import { type CatalogSkill, type LoopPhase } from "../lib/story/skill-map.ts";

export const storyMeta = {
  updatedAt: "2026-10-27",
};

export const skillCatalog = {
  ask: [
    {
      next: "ps:handoff",
      skill: "ps:askme",
      what: "Grills the plan before any work.",
    },
  ],
  build: [
    {
      next: "ps:autopilot",
      skill: "ps:handoff",
      what: "Packs a brief for another session.",
    },
    {
      next: "ps:mic-drop",
      skill: "ps:autopilot",
      what: "Runs a brief to the end.",
    },
    {
      next: "ps:review-panel",
      skill: "ps:iamrich",
      what: "Parallel helpers when tokens are plenty.",
    },
  ],
  care: [
    {
      next: "ps:askme",
      skill: "ps:whatsleft",
      what: "Splits the open work between us.",
    },
    { skill: "ps:sessions", what: "Finds, reads and links sessions." },
    { skill: "ps:bag-mode", what: "Keeps work alive in a bag." },
  ],
  design: [
    {
      next: "ps:design-artifact",
      skill: "ps:design-brainstorm",
      what: "Interviews, researches, then builds knobs.",
    },
    { skill: "ps:design-artifact", what: "One page of live design knobs." },
    { skill: "ps:pick", what: "Numbered variants and a copy button." },
    {
      next: "ps:pick",
      skill: "ps:design-ref",
      what: "Turns reference sites into a design file.",
    },
  ],
  research: [
    {
      next: "ps:askme",
      skill: "ps:captain-research",
      what: "Fans research out to helper agents.",
    },
    { skill: "ps:yt-learn", what: "Turns a video into timed notes." },
    { skill: "ps:map", what: "Writes a short folder map for agents." },
  ],
  review: [
    {
      next: "ps:mic-drop",
      skill: "ps:review-panel",
      what: "Several reviewers, one merged report.",
    },
    {
      skill: "ps:harness-optimize",
      what: "Measures sessions, proposes small trims.",
    },
  ],
  ship: [
    {
      next: "ps:whatsleft",
      skill: "ps:mic-drop",
      what: "Proves the job is done.",
    },
    { skill: "ps:standup", what: "Yesterday, today and blockers from git." },
    { skill: "ps:draft-reply", what: "Drafts a reply, sends after yes." },
  ],
} as const satisfies Record<
  LoopPhase,
  ReadonlyArray<Omit<CatalogSkill, "phase">>
>;
