import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  canonicalSkill,
  outcomeMetrics,
  parseSession,
  phases,
  type SessionRecord,
  shareMetrics,
  skills,
  summarize,
} from "./skill-usage.ts";

const opening = "2026-10-10T08:00:00Z";

const user = (content: unknown): string =>
  JSON.stringify({
    message: { content, role: "user" },
    timestamp: opening,
    type: "user",
    uuid: "u1",
  });

const tool = (
  uuid: string,
  timestamp: string,
  name: string,
  input: Record<string, unknown>,
  extra: Record<string, unknown> = {}
): string =>
  JSON.stringify({
    message: {
      content: [{ id: uuid, input, name, type: "tool_use" }],
      role: "assistant",
    },
    timestamp,
    type: "assistant",
    uuid,
    ...extra,
  });

const slash = (name: string): string =>
  `<command-message>${name}</command-message> <command-name>/${name}</command-name>`;

const session = (
  start: string,
  runs: SessionRecord["runs"],
  extra: Partial<SessionRecord> = {}
): SessionRecord => ({
  artifacts: [],
  briefs: [],
  checks: [],
  kind: "owner",
  mentions: [],
  questions: [],
  runs,
  spawns: [],
  start,
  ...extra,
});

const run = (
  at: string,
  skill: SessionRecord["runs"][number]["skill"],
  turn = 1,
  byAgent = true
): SessionRecord["runs"][number] => ({
  at,
  byAgent,
  named: false,
  skill,
  turn,
});

const kindFor = (text: string): string | undefined =>
  parseSession(
    [
      user(text),
      tool("a1", "2026-10-10T08:01:00Z", "Read", { file_path: "/x" }),
    ],
    new Set()
  )?.kind;

describe("canonicalSkill", () => {
  it("reads every way a skill shows up in the logs", () => {
    assert.equal(canonicalSkill("/ps:askme"), "ps:askme");
    assert.equal(canonicalSkill("ps_askme"), "ps:askme");
    assert.equal(canonicalSkill("askme"), "ps:askme");
    assert.equal(canonicalSkill("ps:hurry-up"), "ps:whatsleft");
    assert.equal(canonicalSkill("ps-grilling"), "ps:askme");
  });

  it("drops skills that are not in the harness", () => {
    assert.equal(canonicalSkill("superpowers:brainstorming"), undefined);
    assert.equal(canonicalSkill("ps:commit-message"), undefined);
  });
});

describe("parseSession", () => {
  it("counts slash commands and Skill calls once and skips side chains", () => {
    const lines = [
      user(slash("ps:whatsleft")),
      tool("a1", "2026-10-10T08:01:00Z", "Skill", { skill: "ps_askme" }),
      tool("a2", "2026-10-10T08:02:00Z", "AskUserQuestion", {
        questions: [{}, {}],
      }),
      tool(
        "a3",
        "2026-10-10T08:03:00Z",
        "Skill",
        { skill: "ps:handoff" },
        { isSidechain: true }
      ),
      "not json",
    ];
    const record = parseSession(lines, new Set());
    assert.ok(record);
    assert.deepEqual(
      record.runs.map((item) => [item.skill, item.byAgent, item.turn]),
      [
        ["ps:whatsleft", false, 1],
        ["ps:askme", true, 1],
      ]
    );
    assert.deepEqual(record.questions, [
      { at: "2026-10-10T08:02:00Z", count: 2 },
    ]);
    assert.equal(record.kind, "owner");
  });

  it("marks a Skill call the owner named in the prompt", () => {
    const record = parseSession(
      [
        user("please write a hand off for this"),
        tool("a1", "2026-10-10T08:01:00Z", "Skill", { skill: "ps:handoff" }),
      ],
      new Set()
    );
    assert.equal(record?.runs[0]?.named, true);
  });

  it("drops a log that only repeats another log", () => {
    const seen = new Set<string>();
    const lines = [
      user(slash("ps:mic-drop")),
      tool("a1", "2026-10-10T08:01:00Z", "Bash", { command: "pnpm check" }),
    ];
    const first = parseSession(lines, seen);
    assert.ok(first);
    assert.equal(first.runs.length, 1);
    assert.deepEqual(first.checks, ["2026-10-10T08:01:00Z"]);
    assert.equal(parseSession(lines, seen), undefined);
  });

  it("drops sessions with no tool call", () => {
    const lines = [user("Reply with OK.")];
    assert.equal(parseSession(lines, new Set()), undefined);
  });

  it("tells hand-off and side sessions from owner sessions", () => {
    assert.equal(kindFor("Read .agents/handoffs/a.md and do it."), "handoff");
    assert.equal(
      kindFor("Background (from the session that started this one): x"),
      "side"
    );
    assert.equal(kindFor("fix the footer"), "owner");
  });
});

describe("summarize", () => {
  const sessions = [
    session("2026-10-01T08:00:00Z", []),
    session(
      "2026-10-03T08:00:00Z",
      [
        run("2026-10-03T08:00:00Z", "ps:whatsleft", 1, false),
        run("2026-10-03T08:01:00Z", "ps:askme"),
        run("2026-10-03T09:00:00Z", "ps:handoff", 2),
      ],
      {
        briefs: [{ at: "2026-10-03T09:01:00Z", file: "2026-10-03-a.md" }],
        questions: [{ at: "2026-10-03T08:02:00Z", count: 3 }],
      }
    ),
    session(
      "2026-10-04T08:00:00Z",
      [run("2026-10-04T08:00:00Z", "ps:autopilot")],
      { kind: "handoff", mentions: ["Read 2026-10-03-a.md and do it"] }
    ),
    session("2026-10-04T10:00:00Z", [], { kind: "side" }),
    session("2026-10-05T10:00:00Z", []),
  ];
  const usage = summarize(sessions, "2026-10-05T12:00:00+02:00");

  it("starts the period at the first skill run", () => {
    assert.deepEqual(usage.period, { from: "2026-10-03", to: "2026-10-05" });
    assert.equal(usage.sample.sessions, 4);
  });

  it("gives shares, never counts, per session kind", () => {
    assert.equal(usage.shares.ownerSessionsWithSkill, 0.5);
    assert.equal(usage.shares.handoffSessionsWithSkill, 1);
    assert.equal(usage.shares.sideSessionsWithSkill, 0);
    assert.equal(usage.shares.agentStarted, 0.75);
    assert.equal(usage.shares.skillToSkill, 0.5);
  });

  it("links a brief to the session that opened it", () => {
    const handoff = usage.skills.find((item) => item.skill === "ps:handoff");
    assert.deepEqual(handoff?.outcome, {
      metric: "briefOpened",
      sample: 1,
      share: 1,
    });
    const askme = usage.skills.find((item) => item.skill === "ps:askme");
    assert.equal(askme?.outcome?.share, 1);
  });

  it("orders chains by how often one skill follows another", () => {
    assert.deepEqual(usage.chains[0], {
      from: "ps:askme",
      share: 0.5,
      to: "ps:handoff",
    });
  });

  it("shares per phase add up to one", () => {
    const total = usage.phases.reduce((sum, item) => sum + item.share, 0);
    assert.ok(Math.abs(total - 1) < 0.01);
  });
});

describe("src/data/skill-usage.json", () => {
  const data: unknown = JSON.parse(
    readFileSync("src/data/skill-usage.json", "utf8")
  );
  const keys = new Set<string>([
    ...shareMetrics,
    "chains",
    "date",
    "firstRun",
    "from",
    "metric",
    "outcome",
    "ownerSessions",
    "period",
    "phase",
    "phases",
    "runs",
    "sample",
    "sessions",
    "share",
    "shares",
    "skill",
    "skills",
    "to",
    "trend",
    "updatedAt",
  ]);
  const words = new Set<string>([
    ...outcomeMetrics,
    ...phases,
    ...shareMetrics,
    ...skills,
  ]);
  const day = /^\d{4}-\d{2}-\d{2}$/u;
  const stamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/u;
  const walk = (value: unknown, found: string[], names: string[]): void => {
    if (typeof value === "string") found.push(value);
    if (typeof value === "number") numbers.push(value);
    if (Array.isArray(value))
      for (const item of value) walk(item, found, names);
    else if (typeof value === "object" && value !== null)
      for (const [key, item] of Object.entries(value)) {
        names.push(key);
        walk(item, found, names);
      }
  };
  const found: string[] = [];
  const numbers: number[] = [];
  const names: string[] = [];
  walk(data, found, names);

  it("holds only skill names, phase names, metric keys and dates", () => {
    assert.deepEqual(
      found.filter(
        (text) => !words.has(text) && !day.test(text) && !stamp.test(text)
      ),
      []
    );
    assert.deepEqual(
      names.filter((name) => !keys.has(name)),
      []
    );
  });

  it("lists every skill once and only plain numbers", () => {
    assert.equal(new Set(skills).size, skills.length);
    assert.equal(
      found.filter((text) => text.startsWith("ps:")).length,
      skills.length + (data as { chains: unknown[] }).chains.length * 2
    );
    assert.ok(numbers.every((value) => Number.isFinite(value) && value >= 0));
  });
});
