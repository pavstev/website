import { type LoopPhase } from "../lib/story/skill-map.ts";

export const storyMeta = {
  aiApps: 3,
  checkedAt: "2026-10-21",
  handoffK: 300,
  heavierK: 45,
  helperCaps: [3, 1, 0],
  hookMs: 6,
  osFamilies: 3,
  updatedAt: "2026-10-22",
};

export const skillCatalog = {
  ask: [{ skill: "ps:askme", what: "Grills the plan before any work." }],
  build: [
    { skill: "ps:handoff", what: "Packs a brief for another session." },
    { skill: "ps:autopilot", what: "Runs a brief to the end." },
    { skill: "ps:iamrich", what: "Parallel helpers when tokens are plenty." },
  ],
  care: [
    { skill: "ps:whatsleft", what: "Splits the open work between us." },
    { skill: "ps:sessions", what: "Finds, reads and links sessions." },
    { skill: "ps:bag-mode", what: "Keeps work alive in a bag." },
  ],
  design: [
    {
      skill: "ps:design-brainstorm",
      what: "Interviews, researches, then builds knobs.",
    },
    { skill: "ps:design-artifact", what: "One page of live design knobs." },
    { skill: "ps:pick", what: "Numbered variants and a copy button." },
  ],
  research: [
    {
      skill: "ps:captain-research",
      what: "Fans research out to helper agents.",
    },
    { skill: "ps:yt-learn", what: "Turns a video into timed notes." },
    { skill: "ps:map", what: "Writes a short folder map for agents." },
  ],
  review: [
    {
      skill: "ps:review-panel",
      what: "Several reviewers, one merged report.",
    },
    {
      skill: "ps:harness-optimize",
      what: "Measures sessions, proposes small trims.",
    },
  ],
  ship: [
    { skill: "ps:mic-drop", what: "Proves the job is done." },
    { skill: "ps:standup", what: "Yesterday, today and blockers from git." },
    { skill: "ps:draft-reply", what: "Drafts a reply, sends after yes." },
  ],
} as const satisfies Record<
  LoopPhase,
  ReadonlyArray<{ skill: `ps:${string}`; what: string }>
>;
