import path from "node:path";
import * as z from "zod";

import { skillCatalog } from "../src/data/dotfiles-stats.ts";

export type Phase = keyof typeof skillCatalog;
export type Skill = (typeof skillCatalog)[Phase][number]["skill"];
type SessionKind = "handoff" | "owner" | "side";

const skillsIn = (phase: Phase): Skill[] =>
  (skillCatalog[phase] as ReadonlyArray<{ skill: Skill }>).map(
    (entry) => entry.skill
  );

export const phases = Object.keys(skillCatalog) as Phase[];
export const skills: Skill[] = phases.flatMap((phase) => skillsIn(phase));

export const outcomeMetrics = [
  "batched",
  "briefOpened",
  "checked",
  "fanOut",
  "handedOn",
  "noQuestion",
  "pickPage",
] as const;

type OutcomeMetric = (typeof outcomeMetrics)[number];

export const shareMetrics = [
  "agentStarted",
  "handoffSessionsWithSkill",
  "ownerSessionsWithSkill",
  "sideSessionsWithSkill",
  "skillToSkill",
  "skillsUsed",
  "unprompted",
] as const;

type ShareMetric = (typeof shareMetrics)[number];

const renamed: Record<string, Skill> = {
  grilling: "ps:askme",
  "hurry-up": "ps:whatsleft",
};

export interface SessionRecord {
  artifacts: string[];
  briefs: Brief[];
  checks: string[];
  kind: SessionKind;
  mentions: string[];
  questions: Questions[];
  runs: SkillRun[];
  spawns: string[];
  start: string;
}

export interface SkillUsage {
  chains: Chain[];
  period: { from: string; to: string };
  phases: PhaseShare[];
  sample: { ownerSessions: number; runs: number; sessions: number };
  shares: Record<ShareMetric, number>;
  skills: SkillShare[];
  trend: TrendPoint[];
  updatedAt: string;
}

interface Brief extends Stamp {
  file: string;
}

interface Chain {
  from: Skill;
  share: number;
  to: Skill;
}

interface Outcome {
  metric: OutcomeMetric;
  sample: number;
  share: number;
}

interface PhaseShare {
  phase: Phase;
  share: number;
}

interface Questions extends Stamp {
  count: number;
}

interface SkillRun {
  at: string;
  byAgent: boolean;
  named: boolean;
  skill: Skill;
  turn: number;
}

interface SkillShare {
  firstRun: null | string;
  outcome: null | Outcome;
  phase: Phase;
  sessions: number;
  share: number;
  skill: Skill;
}

interface Stamp {
  at: string;
}

interface TrendPoint {
  date: string;
  share: number;
}

const commandName = /<command-name>\/([^<\s]+)<\/command-name>/u;
const reminder = /<system-reminder>[\s\S]*?<\/system-reminder>/gu;
const handoffStart = /^Read \S+ and do it/u;
const sideStart = "Background (from the session that started this one)";
const briefPath = /handoff|\/\.agents\//iu;
const checkCommand =
  /\b(?:cargo|go|just|make|node|npm|npx|pnpm|uv|yarn)\s[^\n&;|]*\b(?:build|check|clippy|lint|nextest|test|typecheck)\b|\b(?:eslint|pytest|ruff|tsc|vitest)\b/u;
const minTrendSessions = 3;
const trendDays = 7;
const chainLimit = 10;
const mentionPrompts = 3;

export const canonicalSkill = (raw: string): Skill | undefined => {
  const bare = raw.trim().replace(/^\//u, "");
  const slug = bare.replace(/^ps[:_-]/u, "");
  const name = renamed[slug] ?? `ps:${slug}`;
  return skills.find((skill) => skill === name);
};

const phaseOf = (skill: Skill): Phase =>
  phases.find((phase) => skillsIn(phase).includes(skill)) ?? "care";

const InputSchema = z.object({
  command: z.string().optional(),
  file_path: z.string().optional(),
  questions: z.array(z.unknown()).optional(),
  skill: z.string().optional(),
});

const PartSchema = z.object({
  input: InputSchema.optional(),
  name: z.string().optional(),
  text: z.string().optional(),
  type: z.string(),
});

const LineSchema = z.object({
  isMeta: z.boolean().optional(),
  isSidechain: z.boolean().optional(),
  message: z.object({ content: z.unknown() }).optional(),
  timestamp: z.string(),
  type: z.enum(["assistant", "user"]),
  uuid: z.string().optional(),
});

type Input = z.infer<typeof InputSchema>;
type Line = z.infer<typeof LineSchema>;
type Part = z.infer<typeof PartSchema>;

const parts = (content: unknown): Part[] =>
  Array.isArray(content)
    ? content.flatMap((item) => {
        const part = PartSchema.safeParse(item);
        return part.success ? [part.data] : [];
      })
    : [];

const userText = (content: unknown): string =>
  typeof content === "string"
    ? content
    : parts(content)
        .filter((part) => part.type === "text")
        .map((part) => part.text ?? "")
        .join(" ");

const ownText = (text: string): string => text.replaceAll(reminder, "").trim();

const squash = (text: string): string =>
  text.toLowerCase().replaceAll(/[^a-z0-9]/gu, "");

const namesSkill = (prompt: string, skill: Skill): boolean =>
  squash(prompt).includes(squash(skill.replace("ps:", "")));

const kindOf = (first: string): SessionKind => {
  if (handoffStart.test(first)) return "handoff";
  return first.startsWith(sideStart) ? "side" : "owner";
};

interface Draft {
  prompts: string[];
  record: SessionRecord;
  tools: number;
}

const readUser = (
  draft: Draft,
  line: Line,
  fresh: boolean,
  at: string
): void => {
  const content = line.message?.content;
  if (
    line.isMeta === true ||
    parts(content).some((part) => part.type === "tool_result")
  )
    return;
  const text = userText(content);
  if (text.trim().length === 0) return;
  draft.prompts.push(ownText(text));
  const command = commandName.exec(text)?.[1];
  const skill = command ? canonicalSkill(command) : undefined;
  if (skill && fresh)
    draft.record.runs.push({
      at,
      byAgent: false,
      named: true,
      skill,
      turn: draft.prompts.length,
    });
};

const markArtifact = (draft: Draft, _input: Input, at: string): void => {
  draft.record.artifacts.push(at);
};

const toolReaders: Record<
  string,
  (draft: Draft, input: Input, at: string) => void
> = {
  Agent: (draft, _input, at) => {
    draft.record.spawns.push(at);
  },
  Artifact: markArtifact,
  AskUserQuestion: (draft, input, at) => {
    draft.record.questions.push({ at, count: input.questions?.length ?? 0 });
  },
  Bash: (draft, input, at) => {
    if (checkCommand.test(input.command ?? "")) draft.record.checks.push(at);
  },
  mcp__visualize__show_widget: markArtifact,
  Read: (draft, input) => {
    draft.record.mentions.push(path.basename(input.file_path ?? ""));
  },
  Skill: (draft, input, at) => {
    const skill = canonicalSkill(input.skill ?? "");
    if (skill)
      draft.record.runs.push({
        at,
        byAgent: true,
        named: namesSkill(draft.prompts.at(-1) ?? "", skill),
        skill,
        turn: draft.prompts.length,
      });
  },
  Write: (draft, input, at) => {
    const file = input.file_path ?? "";
    if (briefPath.test(file))
      draft.record.briefs.push({ at, file: path.basename(file) });
  },
};

const readTool = (draft: Draft, part: Part, at: string): void => {
  draft.tools += 1;
  toolReaders[part.name ?? ""]?.(draft, part.input ?? {}, at);
};

const lineOf = (raw: string): Line | undefined => {
  if (!raw.startsWith("{")) return undefined;
  try {
    const line = LineSchema.safeParse(JSON.parse(raw));
    return line.success ? line.data : undefined;
  } catch {
    return undefined;
  }
};

export const parseSession = (
  lines: Iterable<string>,
  seen: Set<string>
): SessionRecord | undefined => {
  const draft: Draft = {
    prompts: [],
    record: {
      artifacts: [],
      briefs: [],
      checks: [],
      kind: "owner",
      mentions: [],
      questions: [],
      runs: [],
      spawns: [],
      start: "",
    },
    tools: 0,
  };
  for (const raw of lines) {
    const line = lineOf(raw);
    if (!line || line.isSidechain === true) continue;
    const at = line.timestamp;
    if (draft.record.start.length === 0) draft.record.start = at;
    const id = line.uuid ?? "";
    const fresh = !seen.has(id);
    seen.add(id);
    if (line.type === "user") readUser(draft, line, fresh, at);
    else if (fresh) {
      const calls = parts(line.message?.content);
      for (const part of calls)
        if (part.type === "tool_use") readTool(draft, part, at);
    }
  }
  if (draft.tools === 0 || draft.prompts.length === 0) return undefined;
  return {
    ...draft.record,
    kind: kindOf(draft.prompts[0] ?? ""),
    mentions: [
      ...draft.record.mentions,
      ...draft.prompts.slice(0, mentionPrompts),
    ],
  };
};

const ratio = (part: number, whole: number): number =>
  whole === 0 ? 0 : Math.round((part / whole) * 1000) / 1000;

const day = (at: string): string => at.slice(0, 10);

const addDays = (date: string, days: number): string => {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
};

const runsIn = (sessions: SessionRecord[]): SkillRun[] =>
  sessions.flatMap((session) => session.runs);

const nextRunAt = (session: SessionRecord, run: SkillRun): string =>
  session.runs.find((other) => other.at > run.at && other.skill !== run.skill)
    ?.at ?? "9999";

const within = (at: string, run: SkillRun, end: string): boolean =>
  at >= run.at && at < end;

interface RunWindow {
  end: string;
  run: SkillRun;
  session: SessionRecord;
}

const shareOf = (
  metric: OutcomeMetric,
  windows: RunWindow[],
  test: (window: RunWindow) => boolean
): Outcome => ({
  metric,
  sample: windows.length,
  share: ratio(windows.filter((window) => test(window)).length, windows.length),
});

const firstCards = (windows: RunWindow[]): Outcome => {
  const firsts = windows.flatMap(({ end, run, session }) =>
    session.questions.filter((card) => within(card.at, run, end)).slice(0, 1)
  );
  return {
    metric: "batched",
    sample: firsts.length,
    share: ratio(firsts.filter((card) => card.count > 1).length, firsts.length),
  };
};

const openedBriefs = (
  windows: RunWindow[],
  sessions: SessionRecord[]
): Outcome => {
  const briefs = new Map(
    windows.flatMap(({ end, run, session }) =>
      session.briefs
        .filter((brief) => within(brief.at, run, end))
        .slice(0, 1)
        .map((brief) => [brief.file, { brief, session }] as const)
    )
  );
  const unique = briefs.values().toArray();
  const opened = unique.filter(({ brief, session }) =>
    sessions.some(
      (other) =>
        other !== session &&
        other.start >= brief.at &&
        other.mentions.some((text) => text.includes(brief.file))
    )
  );
  return {
    metric: "briefOpened",
    sample: unique.length,
    share: ratio(opened.length, unique.length),
  };
};

const fanOut = (windows: RunWindow[]): Outcome =>
  shareOf(
    "fanOut",
    windows,
    ({ run, session }) => session.spawns.filter((at) => at >= run.at).length > 1
  );

const outcomes: Partial<
  Record<Skill, (windows: RunWindow[], sessions: SessionRecord[]) => Outcome>
> = {
  "ps:askme": firstCards,
  "ps:autopilot": (windows) =>
    shareOf("noQuestion", windows, ({ end, run, session }) =>
      session.questions.every((card) => !within(card.at, run, end))
    ),
  "ps:captain-research": fanOut,
  "ps:handoff": openedBriefs,
  "ps:iamrich": fanOut,
  "ps:mic-drop": (windows) =>
    shareOf("checked", windows, ({ run, session }) =>
      session.checks.some((at) => at >= run.at)
    ),
  "ps:pick": (windows) =>
    shareOf("pickPage", windows, ({ end, run, session }) =>
      session.artifacts.some((at) => within(at, run, end))
    ),
  "ps:whatsleft": (windows) =>
    shareOf("handedOn", windows, ({ run, session }) =>
      session.runs.some(
        (other) =>
          other.turn === run.turn &&
          other.at > run.at &&
          other.skill !== run.skill
      )
    ),
};

const outcomeFor = (
  skill: Skill,
  sessions: SessionRecord[]
): null | Outcome => {
  const measure = outcomes[skill];
  if (!measure) return null;
  const windows = sessions.flatMap((session) =>
    session.runs
      .filter((run) => run.skill === skill)
      .map((run) => ({ end: nextRunAt(session, run), run, session }))
  );
  return windows.length > 0 ? measure(windows, sessions) : null;
};

const links = (session: SessionRecord): Array<[SkillRun, SkillRun]> => {
  const steps = session.runs.filter(
    (run, index) => run.skill !== session.runs[index - 1]?.skill
  );
  return steps.slice(1).flatMap((run, index) => {
    const before = steps[index];
    return before ? [[before, run]] : [];
  });
};

const chainsOf = (sessions: SessionRecord[]): Chain[] => {
  const all = sessions.flatMap((session) => links(session));
  const counts = new Map<string, { from: Skill; n: number; to: Skill }>();
  for (const [from, to] of all) {
    const key = `${from.skill}>${to.skill}`;
    const entry = counts.get(key) ?? { from: from.skill, n: 0, to: to.skill };
    entry.n += 1;
    counts.set(key, entry);
  }
  return counts
    .values()
    .toArray()
    .toSorted(
      (a, b) =>
        b.n - a.n || a.from.localeCompare(b.from) || a.to.localeCompare(b.to)
    )
    .slice(0, chainLimit)
    .map(({ from, n, to }) => ({ from, share: ratio(n, all.length), to }));
};

const trendOf = (
  owner: SessionRecord[],
  from: string,
  to: string
): TrendPoint[] => {
  const points: TrendPoint[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const start = addDays(date, 1 - trendDays);
    const window = owner.filter(
      (session) => day(session.start) >= start && day(session.start) <= date
    );
    if (window.length >= minTrendSessions)
      points.push({
        date,
        share: ratio(
          window.filter((session) => session.runs.length > 0).length,
          window.length
        ),
      });
  }
  return points;
};

const withSkill = (sessions: SessionRecord[], kind: SessionKind): number => {
  const group = sessions.filter((session) => session.kind === kind);
  return ratio(
    group.filter((session) => session.runs.length > 0).length,
    group.length
  );
};

export const summarize = (
  logs: SessionRecord[],
  updatedAt: string
): SkillUsage => {
  const all = logs.toSorted((a, b) => a.start.localeCompare(b.start));
  const firstRun = runsIn(all)
    .map((run) => run.at)
    .toSorted((a, b) => a.localeCompare(b))[0];
  const from = day(firstRun ?? updatedAt);
  const to = day(updatedAt);
  const sessions = all.filter((session) => day(session.start) >= from);
  const owner = sessions.filter((session) => session.kind === "owner");
  const runs = runsIn(sessions);
  const chainLinks = sessions.flatMap((session) => links(session));
  const used = skills.filter((skill) =>
    runs.some((run) => run.skill === skill)
  );
  return {
    chains: chainsOf(sessions),
    period: { from, to },
    phases: phases.map((phase) => ({
      phase,
      share: ratio(
        runs.filter((run) => phaseOf(run.skill) === phase).length,
        runs.length
      ),
    })),
    sample: {
      ownerSessions: owner.length,
      runs: runs.length,
      sessions: sessions.length,
    },
    shares: {
      agentStarted: ratio(
        runs.filter((run) => run.byAgent).length,
        runs.length
      ),
      handoffSessionsWithSkill: withSkill(sessions, "handoff"),
      ownerSessionsWithSkill: withSkill(sessions, "owner"),
      sideSessionsWithSkill: withSkill(sessions, "side"),
      skillsUsed: ratio(used.length, skills.length),
      skillToSkill: ratio(
        chainLinks.filter(([before, after]) => before.turn === after.turn)
          .length,
        chainLinks.length
      ),
      unprompted: ratio(
        runs.filter((run) => run.byAgent && !run.named).length,
        runs.length
      ),
    },
    skills: skills.map((skill) => {
      const mine = runs.filter((run) => run.skill === skill);
      return {
        firstRun: mine[0] ? day(mine[0].at) : null,
        outcome: outcomeFor(skill, sessions),
        phase: phaseOf(skill),
        sessions: ratio(
          sessions.filter((session) =>
            session.runs.some((run) => run.skill === skill)
          ).length,
          sessions.length
        ),
        share: ratio(mine.length, runs.length),
        skill,
      };
    }),
    trend: trendOf(owner, from, to),
    updatedAt,
  };
};
