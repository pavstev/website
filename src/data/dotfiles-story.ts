import { type DotfilesFacts } from "../lib/dotfiles-facts.ts";
import { en } from "../lib/i18n.ts";
import { type SceneCounts } from "../lib/story/blueprint-geometry.ts";
import {
  type CatalogSkill,
  type LoopPhase,
  loopPhases,
  skillMap,
} from "../lib/story/skill-map.ts";
import { type StepId } from "../lib/story/step-ids.ts";
import { type StoryStep } from "../lib/story/steps.ts";
import { skillCatalog } from "./dotfiles-stats.ts";

export const bootstrapLine =
  'sh -c "$(curl -fsSL https://raw.githubusercontent.com/pavstev/dotfiles/main/bootstrap.sh)"';

export const uninstallLine = "dots uninstall";

export interface SkillCopy {
  flow: string;
  phase: string;
  skill: string;
  what: string;
}

type StoryCopy = Pick<StoryStep, "eyebrow" | "line" | "note" | "strip">;

interface StoryName {
  label: string;
  value: string;
}

export const skillEntries: readonly CatalogSkill[] = loopPhases.flatMap(
  (phase: LoopPhase) =>
    skillCatalog[phase].map((entry): CatalogSkill => ({ ...entry, phase }))
);

const newWhat = "A new skill in the harness.";
const newFlow = "New in the harness.";

const bare = (skill: string): string => skill.replace("ps:", "");

export const skillCopy = (names?: readonly string[]): SkillCopy[] => {
  const map = skillMap(skillEntries, names);
  return map.stops.map((stop, k) => {
    const entry = skillEntries.find((item) => item.skill === stop.skill);
    const out = map.chains.find((chain) => chain.from === k);
    const into = map.chains.find((chain) => chain.to === k);
    const target = out ? map.stops[out.to]?.skill : undefined;
    const source = into ? map.stops[into.from]?.skill : undefined;
    const flow = stop.known
      ? target
        ? `Hands on to ${bare(target)}.`
        : source
          ? `Takes work from ${bare(source)}.`
          : "Works on its own."
      : newFlow;
    return {
      flow,
      phase: stop.phase,
      skill: stop.skill,
      what: entry?.what ?? newWhat,
    };
  });
};

export const skillFacts = (names?: readonly string[]): string[] => {
  const map = skillMap(skillEntries, names);
  const phases = loopPhases
    .map((phase) => {
      const skills = map.stops
        .filter((stop) => stop.phase === phase)
        .map((stop) => bare(stop.skill));
      return skills.length > 0 ? `${phase}: ${skills.join(", ")}` : "";
    })
    .filter((line) => line.length > 0)
    .join("; ");
  const handOffs = map.chains
    .map(
      (chain) =>
        `${bare(map.stops[chain.from]?.skill ?? "")} then ${bare(map.stops[chain.to]?.skill ?? "")}`
    )
    .join(", ");
  return [
    `Skills by phase of the work loop. ${phases}.`,
    `Hand-offs the skills are built for: ${handOffs}.`,
  ];
};

export const stepCopy = (): Record<StepId, StoryCopy> => ({
  c01: {
    eyebrow: "Repo",
    line: "Plain git, no manager",
    note: "The repo is the single source of truth. Every file in home/ mirrors $HOME through a symlink, so I edit either side and the change is live at once. No manager, no template engine, no apply step. Fewer parts, fewer ways to drift.",
    strip: {
      command: 'readlink ~/.zshrc | sed "s|$HOME|~|"',
      output: ["~/dotfiles/home/.zshrc"],
    },
  },
  c02: {
    eyebrow: "Install",
    line: "One line, any machine",
    note: "I paste one line in a terminal and walk away. It asks a few questions, then runs its steps in order: prerequisites, package manager, tools, Rust, Node, agents, git hooks. A step that fails warns and steps aside. The run goes on.",
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
    eyebrow: "Doctor",
    line: "Safe to run twice",
    note: "Every step skips what is already there. An older file moves to a .bak copy before its link goes in. When something feels off I run dots doctor, which prints one PASS or FAIL line per check. A check changes nothing.",
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
    eyebrow: "Platforms",
    line: "Tested on macOS, Linux, Windows",
    note: "macOS, the main Linux distros and Windows in Git Bash are all first class. One command runs the check on all of them at once: macOS here, Linux in fresh containers, Windows in a throwaway VM. The Rust side runs its own tests too.",
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
    eyebrow: "Privacy",
    line: "Public, but private",
    note: "The repo is public, so it holds nothing personal: no names, no emails, no home paths, no secrets. My rules live in one private file outside the repo. Git hooks block private words before each commit and push. The guard never reads my secrets.",
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
    eyebrow: "Agents",
    line: "One source for every agent",
    note: "Claude Code, Cursor and Opencode read the same rules, skills and agents from one folder. Claude gets symlinks. Cursor and Opencode get generated rules and agents with a marker that says they are ours. A file without the marker is yours and is never touched.",
    strip: {
      command: 'rg -o "generated-by: dotfiles" .cursor/rules',
      output: [
        ".cursor/rules/claude-global.mdc:generated-by: dotfiles",
        ".cursor/rules/claude-output-style.mdc:generated-by: dotfiles",
      ],
    },
  },
  h1: {
    eyebrow: "The guard",
    line: "One tool call",
    note: "A hook runs on every call and fails open. It hands the call to the guard, a Rust program of named checks. The router picks the model and the effort. A denied call comes back with the rule and the fix.",
    strip: {
      command: "sh ~/.claude/hooks/rust-bin --hook guard pretool",
      output: [
        "G14: bare sed -i on macOS eats the script as the backup suffix. Give a suffix: `sed -i '' 's/a/b/' f` (or `-i.bak`). Or use the Edit tool.",
        "exit 2",
      ],
    },
  },
  h2: {
    eyebrow: "The ledger",
    line: "The token ledger",
    note: "My time is the cost that counts, and tokens are the second cost. So the guard says no before a helper spends anything. Each row is one rule and the reason it exists. Together they make the weekly budget last all the work days.",
    strip: {
      output: [
        "preset   off: no tokens",
        "hook     sh, not bash: less time on every call",
        "router   opus: plans, final review. haiku: lookups. sonnet: the rest. xhigh, max: never",
        "G8 G7    a few helpers at once, fewer when the week runs ahead. general-purpose: refused, much heavier",
        "status   copper when the context runs full. hand off to a file",
      ],
      title: "token ledger",
    },
  },
  h3: {
    eyebrow: "The roster",
    line: "Every agent, pinned down",
    note: "Skills such as askme, agents such as worker, presets I switch on and off. Each agent gets one model, one effort and only the tools it needs. Every hand-back starts with a status word and has a cap. A pre-commit check keeps the descriptions honest.",
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
    eyebrow: "The harness",
    line: "Rules in code, not prompts",
    note: "Every tool call my AI agents make passes through a Rust guard: every check in Claude Code, a few in Cursor and Opencode. Time and tokens are the cost that counts. A prompt can be ignored. Code cannot.",
  },
  hero: {
    eyebrow: "Start",
    line: "dotfiles",
    note: `${en.story.metaDescription} This is how it fits together.`,
  },
  outro: {
    eyebrow: "End",
    line: "Take it all back",
    note: `One line installs it. One command takes it back: ${uninstallLine}. It removes the links and the generated files, and puts the old files back. Your own tools and settings stay.`,
  },
  skills: {
    eyebrow: "The skills",
    line: "The work loop, walked",
    note: "Every skill sits along the way I work, from the first question to the end of a session. Each bridge is a hand-off a skill is built for, and the hubs stand taller. A session can run from a plan to a proven finish.",
  },
});

export const sceneCounts = (facts: DotfilesFacts): SceneCounts => ({
  agents: facts.agents,
  guardChecks: facts.guardChecks,
  homeFiles: facts.homeFiles,
  hookEvents: facts.hookEvents,
  outputStyles: facts.outputStyles,
  presets: facts.presets,
  rustPrograms: facts.rustPrograms,
  skills: facts.skills,
});

export const storyNames: { harness: StoryName[]; hero: StoryName[] } = {
  harness: [
    { label: "sed -i, denied", value: "G14" },
    { label: "plans, review", value: "opus" },
    { label: "lookups", value: "haiku" },
    { label: "the rest", value: "sonnet" },
  ],
  hero: [
    { label: "shell", value: "zsh" },
    { label: "runtimes", value: "mise" },
    { label: "search", value: "rg" },
    { label: "guard", value: "Rust" },
    { label: "agents", value: "Claude Code" },
    { label: "editor", value: "Cursor" },
  ],
};
