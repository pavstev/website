import { type DotfilesFacts } from "../lib/dotfiles-facts.ts";
import { type SceneCounts } from "../lib/story/blueprint-geometry.ts";
import { digits as n, percent, say } from "../lib/story/number-words.ts";
import { loopPhases, skillMap } from "../lib/story/skill-map.ts";
import { type StepId } from "../lib/story/step-ids.ts";
import { type StoryStep } from "../lib/story/steps.ts";
import { skillCatalog, storyMeta } from "./dotfiles-stats.ts";
import skillUsage from "./skill-usage.json" with { type: "json" };

export type SkillUsageData = typeof skillUsage;

export const bootstrapLine =
  'sh -c "$(curl -fsSL https://raw.githubusercontent.com/pavstev/dotfiles/main/bootstrap.sh)"';

export const uninstallLine = "dots uninstall";

export interface SkillCopy {
  metric: string;
  phase: string;
  skill: string;
  what: string;
}

type StoryCopy = Pick<StoryStep, "eyebrow" | "line" | "note" | "strip">;

const skillWhat = new Map<string, string>(
  Object.values(skillCatalog).flatMap((entries) =>
    entries.map((entry) => [entry.skill, entry.what] as const)
  )
);

const outcomeLines: Record<string, (share: string) => string> = {
  batched: (share) =>
    `${share} of runs batched the first questions in one card.`,
  briefOpened: (share) => `${share} of briefs were opened by a later session.`,
  checked: (share) => `${share} of runs ran a real check command.`,
  fanOut: (share) => `${share} of runs fanned out to helper agents.`,
  noQuestion: (share) => `${share} of runs asked me no question.`,
  pickPage: (share) => `${share} of runs showed a pick page.`,
};

const shortDay = (date: string): string =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

const bare = (skill: string): string => skill.replace("ps:", "");

const metricOf = (item: SkillUsageData["skills"][number]): string => {
  const outcome = item.outcome ? outcomeLines[item.outcome.metric] : undefined;
  if (outcome && item.outcome) return outcome(percent(item.outcome.share));
  if (item.share <= 0) return newSkill;
  return Math.round(item.share * 100) === 0
    ? "Fewer than one in a hundred skill runs."
    : `${percent(item.share)} of all skill runs.`;
};

const newSkill = "New, no run yet.";
const newWhat = "A new skill in the harness.";

export const skillCopy = (
  usage: SkillUsageData = skillUsage,
  names?: readonly string[]
): SkillCopy[] =>
  skillMap(usage, names).stops.map((stop) => {
    const item = usage.skills.find((entry) => entry.skill === stop.skill);
    return {
      metric: item ? metricOf(item) : newSkill,
      phase: stop.phase,
      skill: stop.skill,
      what: skillWhat.get(stop.skill) ?? newWhat,
    };
  });

export const skillFacts = (usage: SkillUsageData = skillUsage): string[] => {
  const phases = loopPhases
    .map((phase) => {
      const share =
        usage.phases.find((item) => item.phase === phase)?.share ?? 0;
      return `${phase} ${percent(share)}`;
    })
    .join(", ");
  const chains = usage.chains
    .map(
      (chain) =>
        `${bare(chain.from)} then ${bare(chain.to)} ${percent(chain.share)}`
    )
    .join(", ");
  const first = usage.trend[0];
  const last = usage.trend.at(-1);
  const trend =
    first && last
      ? `Sessions I opened that ran a skill, counted over the week before each day: ${percent(first.share)} on ${shortDay(first.date)}, ${percent(last.share)} on ${shortDay(last.date)}.`
      : "";
  return [
    `Share of skill runs by phase: ${phases}.`,
    `Which skill came next in one session, as a share of all such links: ${chains}.`,
    trend,
  ].filter((line) => line.length > 0);
};

interface StoryNumber {
  label: string;
  value: number;
}

export const stepCopy = (
  facts: DotfilesFacts,
  usage: SkillUsageData = skillUsage
): Record<StepId, StoryCopy> => {
  const meta = storyMeta;
  const apps = say(meta.aiApps);
  const systems = say(meta.osFamilies);

  return {
    c01: {
      eyebrow: "01",
      line: "Plain git. No manager.",
      note: `The repo is the single source of truth. The ${n(facts.homeFiles)} files in home/ mirror $HOME, and each one is reached through a symlink back, so I edit either side and the change is live at once. No manager, no template engine, no apply step. Fewer parts, fewer ways to drift.`,
      strip: {
        command: 'readlink ~/.zshrc | sed "s|$HOME|~|"',
        output: ["~/dotfiles/home/.zshrc"],
      },
    },
    c02: {
      eyebrow: "02",
      line: "One line, any machine.",
      note: `I paste one line in a terminal and walk away. It asks a few questions, then runs ${n(facts.installSteps)} steps: prerequisites, the package manager, ${n(facts.tools)} tools, Rust, Node, the agents, the git hooks. A step that fails warns and steps aside. The run goes on.`,
      strip: {
        command: bootstrapLine,
        output: [
          "✓ mise installed",
          "✓ rg installed (mise)",
          "✓ fd installed (mise)",
        ],
      },
    },
    c03: {
      eyebrow: "03",
      line: "Safe to run twice.",
      note: `Every step skips what is already there. An older file moves to a .bak copy before its link goes in. When something feels off I run dots doctor, which prints one PASS or FAIL line for each of its ${n(meta.doctorChecks)} checks. A check changes nothing.`,
      strip: {
        command: "dots doctor",
        output: [
          "PASS links",
          "PASS settings-built",
          "PASS bins-fresh",
          "PASS guard-selftest",
        ],
      },
    },
    c04: {
      eyebrow: "04",
      line: `Tested on ${systems} systems.`,
      note: `macOS, ${say(meta.distros)} Linux distros and Windows in Git Bash are all first class. A change must keep each one working, so one command runs the check on all ${systems} at once. macOS runs here, Linux in fresh containers, Windows in a throwaway VM. The Rust side has ${n(meta.tests)} tests.`,
      strip: {
        command: "bash scripts/os-check.sh all",
        output: [
          "PASS  macos",
          "PASS  linux",
          "PASS  windows",
          "RESULT: pass. Logs: .os-check/",
        ],
      },
    },
    c05: {
      eyebrow: "05",
      line: "Public, but private.",
      note: "The repo is public, so it holds nothing personal: no names, no emails, no home paths, no secrets. My own rules live in one private file outside the repo. Git hooks block private words before a commit and before a push. The guard will not read the file that holds my secrets.",
      strip: {
        command: "sed -n 6,9p .gitignore",
        output: [
          ".zshrc.local",
          "local.zsh",
          ".gitconfig.local",
          "Brewfile.local",
        ],
      },
    },
    c06: {
      eyebrow: "06",
      line: `One source, ${apps} AIs.`,
      note: `Claude Code, Cursor and Opencode read the same rules, ${n(facts.skills)} skills and ${n(facts.agents)} agents from one folder. Claude gets symlinks. Cursor and Opencode read the skills in place and get generated rules and agents with a marker that says they are ours. A file without the marker is yours and is never touched.`,
      strip: {
        command: 'rg -o "generated-by: dotfiles" .cursor/rules',
        output: [
          ".cursor/rules/claude-global.mdc:generated-by: dotfiles",
          ".cursor/rules/claude-output-style.mdc:generated-by: dotfiles",
        ],
      },
    },
    h1: {
      eyebrow: "H1",
      line: "One tool call.",
      note: `A hook runs on every call, so it starts with sh and fails open. It hands the call to the guard, ${n(facts.guardChecks)} checks. The router sets the model and the effort, and the pace meter says ok, ahead or critical. A denied call comes back with the rule and the fix.`,
      strip: {
        command: "sh ~/.claude/hooks/rust-bin --hook guard pretool",
        output: [
          "G14: bare sed -i on macOS eats the script as the backup suffix. Give a suffix: `sed -i '' 's/a/b/' f` (or `-i.bak`). Or use the Edit tool.",
          "exit 2",
        ],
      },
    },
    h2: {
      eyebrow: "H2",
      line: "The token ledger.",
      note: "My time is the cost that counts, and tokens are the second cost. So the guard says no before a helper spends anything. Each row is one rule and the reason it exists. Together they make the weekly budget last all the work days.",
      strip: {
        output: [
          "preset   off: no tokens",
          `hook     sh, not bash: about ${n(meta.hookMs)} ms less per call`,
          "router   opus: plans, final review. haiku: lookups. sonnet: the rest. xhigh, max: never",
          `G8 G7    helpers ${meta.helperCaps.map((cap) => n(cap)).join(", ")} at once. general-purpose: refused, about ${n(meta.heavierK)}K heavier`,
          `status   copper at ${n(meta.handoffK)}K. hand off to a file`,
        ],
        title: "token ledger",
      },
    },
    h3: {
      eyebrow: "H3",
      line: "The roster, pinned down.",
      note: `${n(facts.skills)} skills, ${n(facts.agents)} agents, ${n(facts.presets)} presets, ${n(facts.hookEvents)} hook events, ${n(meta.rustPrograms)} Rust programs and ${n(meta.outputStyles)} output styles. Each agent is pinned to a model and an effort, and gets only the tools its job needs. Every hand-back starts with a status word and has a character cap. A pre-commit check keeps the skill descriptions honest.`,
      strip: {
        command:
          'rg "^(name|model|effort|tools|disallowedTools):" claude/agents/worker.md',
        output: [
          "name: worker",
          "model: sonnet",
          "effort: high",
          "tools: Read, Edit, Write, Bash, Grep, Glob",
          "disallowedTools: Agent, NotebookEdit",
        ],
      },
    },
    harness: {
      eyebrow: "H0",
      line: "The harness",
      note: `Every tool call my AI agents make passes through a Rust guard: all ${n(facts.guardChecks)} checks in Claude Code, a few in Cursor and Opencode. Time and tokens are the cost that counts, so the rules live in code, not in a prompt.`,
    },
    hero: {
      eyebrow: "00",
      line: "dotfiles",
      note: `One command sets up a machine the way I work: the shell, ${n(facts.tools)} tools, and the same rules for ${apps} AI coding agents. Scroll to see how it fits together.`,
    },
    outro: {
      eyebrow: "end",
      line: "Take it all back.",
      note: `One line installs it. One command takes it back: ${uninstallLine}. It removes the links and the generated files, and puts the old files back. Your own tools and settings stay.`,
    },
    skills: {
      eyebrow: "H4",
      line: "The work loop, walked.",
      note: `All ${n(facts.skills)} skills sit along the way I work, from the first question to the end of a session. The shares come from my own Claude Code sessions in every work project, ${shortDay(usage.period.from)} to ${shortDay(usage.period.to)}. ${percent(usage.shares.ownerSessionsWithSkill)} of the sessions I opened ran a skill, and the agent started ${percent(usage.shares.agentStarted)} of the runs itself.`,
    },
  };
};

export const sceneCounts = (facts: DotfilesFacts): SceneCounts => ({
  agents: facts.agents,
  distros: storyMeta.distros,
  files: facts.files,
  guardChecks: facts.guardChecks,
  handoffK: storyMeta.handoffK,
  helperCaps: storyMeta.helperCaps,
  homeFiles: facts.homeFiles,
  hookEvents: facts.hookEvents,
  hookMs: storyMeta.hookMs,
  outputStyles: storyMeta.outputStyles,
  presets: facts.presets,
  rustPrograms: storyMeta.rustPrograms,
  skills: facts.skills,
});

export const storyNumbers = (
  facts: DotfilesFacts
): { harness: StoryNumber[]; hero: StoryNumber[] } => ({
  harness: [
    { label: "guard checks", value: facts.guardChecks },
    { label: "skills", value: facts.skills },
    { label: "agents", value: facts.agents },
    { label: "presets", value: facts.presets },
  ],
  hero: [
    { label: "files", value: facts.files },
    { label: "tools", value: facts.tools },
    { label: "steps", value: facts.installSteps },
    { label: "skills", value: facts.skills },
    { label: "agents", value: facts.agents },
    { label: "guard checks", value: facts.guardChecks },
  ],
});

export { default as skillUsage } from "./skill-usage.json" with { type: "json" };
