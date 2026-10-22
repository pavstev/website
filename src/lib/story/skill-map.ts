import { fieldsOf } from "../record.ts";

export const loopPhases = [
  "ask",
  "research",
  "design",
  "build",
  "review",
  "ship",
  "care",
] as const;

export type LoopPhase = (typeof loopPhases)[number];

export interface SkillMap {
  chains: SkillChain[];
  phases: number[];
  stops: SkillStop[];
  trend: number[];
}

export interface SkillSpot {
  x: number;
  z: number;
}

export interface SkillStop {
  phase: LoopPhase;
  ran: boolean;
  share: number;
  skill: string;
}

export interface UsageInput {
  chains: ReadonlyArray<{ from: string; share: number; to: string }>;
  phases: ReadonlyArray<{ phase: string; share: number }>;
  skills: readonly UsageSkill[];
  trend: ReadonlyArray<{ share: number }>;
}

interface SkillChain {
  from: number;
  share: number;
  to: number;
}

interface UsageSkill {
  phase: string;
  share: number;
  skill: string;
}

const columnX = [-1.9, -1.15, -0.4, 0.35, 1.1, 1.85] as const;
const rowZ = [-0.75, -0.2, 0.35] as const;
const careZ = 1;
const careX = [-1.15, -0.4, 0.35] as const;
const rowFrom = -0.8;
const rowTo = 0.45;
const careFrom = -1.4;
const careTo = 0.35;
const gaugeZ = -1.35;
const careGaugeX = -1.9;

const isPhase = (value: string): value is LoopPhase =>
  (loopPhases as readonly string[]).includes(value);

const phaseFor = (usage: UsageInput, skill: string): LoopPhase => {
  const phase = usage.skills.find((item) => item.skill === skill)?.phase;
  return phase !== undefined && isPhase(phase) ? phase : "care";
};

const rankFor = (usage: UsageInput, skill: string): number => {
  const rank = usage.skills.findIndex((item) => item.skill === skill);
  return rank === -1 ? usage.skills.length : rank;
};

export const skillMap = (
  usage: UsageInput,
  names: readonly string[] = usage.skills.map((item) => item.skill)
): SkillMap => {
  const ordered = names.toSorted(
    (a, b) => rankFor(usage, a) - rankFor(usage, b) || a.localeCompare(b)
  );
  const stops = loopPhases.flatMap((phase) =>
    ordered
      .filter((skill) => phaseFor(usage, skill) === phase)
      .map((skill) => {
        const share =
          usage.skills.find((item) => item.skill === skill)?.share ?? 0;
        return { phase, ran: share > 0, share, skill };
      })
  );
  const indexOf = (skill: string): number =>
    stops.findIndex((stop) => stop.skill === skill);
  return {
    chains: usage.chains
      .map((chain) => ({
        from: indexOf(chain.from),
        share: chain.share,
        to: indexOf(chain.to),
      }))
      .filter((chain) => chain.from >= 0 && chain.to >= 0),
    phases: loopPhases.map(
      (phase) => usage.phases.find((item) => item.phase === phase)?.share ?? 0
    ),
    stops,
    trend: usage.trend.map((point) => point.share),
  };
};

const spread = (
  fixed: readonly number[],
  from: number,
  to: number,
  count: number,
  index: number
): number =>
  count <= fixed.length
    ? (fixed[index] ?? 0)
    : from + ((to - from) * index) / Math.max(1, count - 1);

const spotCache = new WeakMap<readonly SkillStop[], readonly SkillSpot[]>();

export const skillSpots = (
  stops: readonly SkillStop[]
): readonly SkillSpot[] => {
  const cached = spotCache.get(stops);
  if (cached) return cached;
  const sizes = new Map<LoopPhase, number>();
  for (const stop of stops)
    sizes.set(stop.phase, (sizes.get(stop.phase) ?? 0) + 1);
  const seen = new Map<LoopPhase, number>();
  const spots = stops.map((stop) => {
    const row = seen.get(stop.phase) ?? 0;
    seen.set(stop.phase, row + 1);
    const size = sizes.get(stop.phase) ?? 1;
    if (stop.phase === "care")
      return { x: spread(careX, careFrom, careTo, size, row), z: careZ };
    return {
      x: columnX[loopPhases.indexOf(stop.phase)] ?? 0,
      z: spread(rowZ, rowFrom, rowTo, size, row),
    };
  });
  spotCache.set(stops, spots);
  return spots;
};

export const gaugeSpot = (phase: LoopPhase): SkillSpot =>
  phase === "care"
    ? { x: careGaugeX, z: careZ }
    : { x: columnX[loopPhases.indexOf(phase)] ?? 0, z: gaugeZ };

export const finaleStops = 2;

export const walkOf = (t: number, count: number): number =>
  count <= 0
    ? 0
    : Math.min(1, Math.max(0, (t * (count + finaleStops)) / count));

export const stopAt = (
  t: number,
  count: number
): { stop: number; u: number } => {
  if (count <= 0) return { stop: 0, u: 0 };
  const scaled = Math.min(count, Math.max(0, t * count));
  const stop = Math.min(count - 1, Math.floor(scaled));
  return { stop, u: scaled - stop };
};

const isShare = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1;

const isStop = (value: unknown): value is SkillStop => {
  const fields = fieldsOf(value);
  if (!fields) return false;
  const phase = fields.get("phase");
  return (
    typeof phase === "string" &&
    isPhase(phase) &&
    typeof fields.get("ran") === "boolean" &&
    isShare(fields.get("share")) &&
    typeof fields.get("skill") === "string"
  );
};

const isChain = (value: unknown, count: number): value is SkillChain => {
  const fields = fieldsOf(value);
  if (!fields) return false;
  const index = (key: string): boolean => {
    const at = fields.get(key);
    return (
      typeof at === "number" &&
      Number.isSafeInteger(at) &&
      at >= 0 &&
      at < count
    );
  };
  return index("from") && index("to") && isShare(fields.get("share"));
};

export const isSkillMap = (value: unknown): value is SkillMap => {
  const fields = fieldsOf(value);
  if (!fields) return false;
  const stops = fields.get("stops");
  const chains = fields.get("chains");
  const phases = fields.get("phases");
  const trend = fields.get("trend");
  return (
    Array.isArray(stops) &&
    stops.every(isStop) &&
    Array.isArray(chains) &&
    chains.every((chain) => isChain(chain, stops.length)) &&
    Array.isArray(phases) &&
    phases.length === loopPhases.length &&
    phases.every(isShare) &&
    Array.isArray(trend) &&
    trend.every(isShare)
  );
};
