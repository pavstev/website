import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sceneCounts, skillUsage } from "../../data/dotfiles-story.ts";
import {
  buildScene,
  frameMatrix,
  project,
  type Scene,
  type SceneCounts,
  strides,
  toneNames,
  viewMatrix,
} from "./blueprint-geometry.ts";
import { sampleFacts } from "./sample-facts.ts";
import { finaleStops, skillMap } from "./skill-map.ts";
import { type StepId } from "./step-ids.ts";

const sampleCounts = sceneCounts(sampleFacts);

const build = (
  step: StepId,
  t: number,
  explode: number,
  counts: SceneCounts = sampleCounts
): Scene => buildScene(step, t, explode, counts);

const steps: StepId[] = [
  "hero",
  "c01",
  "c02",
  "c03",
  "c04",
  "c05",
  "c06",
  "harness",
  "h1",
  "h2",
  "h3",
  "skills",
  "outro",
];

const times = [0, 0.25, 0.5, 0.75, 1];

const ids = (scene: Scene): string[] => scene.labels.map(({ id }) => id);

const ledgerRows = (t: number): number =>
  ids(build("h2", t, 1)).filter((id) => id.startsWith("ledger-")).length;

describe("project", () => {
  it("puts the origin in the middle of the frame", () => {
    const [x, y] = project(
      viewMatrix(1.6, 0, 0),
      { x: 0, y: 0, z: 0 },
      1600,
      1000
    );
    assert.ok(Math.abs(x - 800) < 0.5);
    assert.ok(Math.abs(y - 500) < 0.5);
  });

  it("puts a point at the half height on the top edge", () => {
    const [, y] = project(
      viewMatrix(1.6, 0, 0),
      { x: 0, y: 2.9, z: 0 },
      1600,
      1000
    );
    assert.ok(Math.abs(y) < 1);
  });
});

describe("buildScene", () => {
  it("names the five slabs in the hero", () => {
    const names = build("hero", 1, 1)
      .labels.filter(({ id }) => id.startsWith("slab-"))
      .map(({ text }) => text)
      .toSorted((a, b) => a.localeCompare(b));
    assert.deepEqual(names, ["claude/", "docs/", "home/", "rust/", "scripts/"]);
  });

  it("draws five ledger rows in h2", () => {
    const rows = ids(build("h2", 1, 1)).filter((id) =>
      id.startsWith("ledger-")
    );
    assert.deepEqual(rows, [
      "ledger-1",
      "ledger-2",
      "ledger-3",
      "ledger-4",
      "ledger-5",
    ]);
  });

  it("draws the ledger rows one by one", () => {
    assert.ok(ledgerRows(0.2) < ledgerRows(0.5));
    assert.ok(ledgerRows(0.5) < ledgerRows(1));
  });

  it("adds hatching and the lock in c05", () => {
    assert.ok(
      build("c05", 1, 1).lines.length > build("c05", 0, 1).lines.length
    );
  });

  it("is a pure function of its inputs", () => {
    for (const step of steps) {
      const a = build(step, 0.6, 0.7);
      const b = build(step, 0.6, 0.7);
      assert.deepEqual(a.lines, b.lines);
      assert.deepEqual(a.points, b.points);
      assert.deepEqual(a.labels, b.labels);
    }
  });

  it("keeps every step finite and its arrays in step", () => {
    for (const step of steps) {
      for (const t of times) {
        const s = build(step, t, 1);
        const parts = [s.lines, s.tris, s.points, s.lineColors, s.triColors];
        for (const part of parts) {
          assert.ok(
            part.every((n) => Number.isFinite(n)),
            `${step} ${String(t)}`
          );
        }
        assert.equal(s.lines.length / strides.line, s.lineColors.length / 2);
        assert.equal(s.tris.length / strides.tri, s.triColors.length / 2);
        assert.equal(s.points.length % strides.point, 0);
        assert.ok(s.gridPoints <= s.points.length / strides.point);
        assert.ok(s.slabSegments <= s.lines.length / strides.line);
      }
    }
  });

  it("uses tone indices that name a token", () => {
    for (const step of steps) {
      const s = build(step, 0.7, 1);
      for (let k = 0; k < s.lineColors.length; k += 2) {
        const tone = s.lineColors[k] ?? -1;
        assert.ok(Number.isSafeInteger(tone));
        assert.ok(tone >= 0 && tone < toneNames.length);
      }
      for (const label of s.labels) {
        assert.ok(toneNames.includes(label.tone));
      }
    }
  });

  it("draws the rust slab in the accent tone and the others in line", () => {
    const { lineColors } = build("hero", 0.5, 1);
    const toneOf = (slabIndex: number): string | undefined =>
      toneNames[lineColors[slabIndex * 12 * strides.lineColor] ?? -1];
    assert.equal(toneOf(4), "accent");
    assert.equal(toneOf(0), "line");
  });

  it("puts the title label last", () => {
    for (const step of steps) {
      assert.equal(build(step, 1, 1).labels.at(-1)?.id, "title");
    }
  });

  it("closes the stack at the end of the hero and opens it in the outro", () => {
    assert.ok(build("hero", 1, 1).half < build("outro", 1, 1).half);
    assert.ok(build("hero", 0, 1).half > build("hero", 1, 1).half);
  });

  it("closes every stack when the spread is zero", () => {
    assert.equal(build("outro", 1, 0).half, build("hero", 1, 1).half);
  });

  it("denies the packet once at the guard, then lets it pass", () => {
    assert.ok(ids(build("h1", 0.7, 1)).includes("deny"));
    assert.ok(!ids(build("h1", 1, 1)).includes("deny"));
    assert.ok(ids(build("h1", 1, 1)).includes("pass"));
    const denied = build("h1", 0.7, 1).labels.find(({ id }) => id === "deny");
    assert.equal(denied?.tone, "denied");
  });

  it("takes every number it draws from the counts", () => {
    const counts = { ...sampleCounts, guardChecks: 4, skills: 3 };
    const fewer = build("h1", 1, 1, counts).lines.length;
    const more = build("h1", 1, 1).lines.length;
    assert.equal((more - fewer) / strides.line, 15);
    const ledger = build("h2", 1, 1, { ...counts, hookMs: 9 }).labels.find(
      ({ id }) => id === "ledger-2"
    );
    assert.equal(ledger?.text, "sh  9 ms less per call");
    const roster = build("h3", 1, 1, counts).labels.find(
      ({ id }) => id === "roster-0"
    );
    assert.equal(roster?.text, "3 skills");
  });

  it("runs fast enough for every frame", () => {
    const start = performance.now();
    for (let i = 0; i < 300; i += 1) build("c05", (i % 100) / 100, 1);
    assert.ok(performance.now() - start < 1500);
  });
});

describe("the skills walk", () => {
  const map = skillMap(skillUsage);
  const walk = (t: number, limit = Infinity): Scene =>
    buildScene("skills", t, 1, sampleCounts, limit, map);
  const stopT = (stop: number): number =>
    (stop + 0.9) / (map.stops.length + finaleStops);

  it("lights the current skill and anchors its plate on it", () => {
    for (const stop of [0, 5, 16]) {
      const scene = walk(stopT(stop));
      const name = map.stops[stop]?.skill.replace("ps:", "") ?? "";
      assert.equal(
        scene.labels.find((label) => label.tone === "accent")?.text,
        name
      );
      assert.ok(scene.plate);
    }
  });

  it("draws more of the path and the charts as the walk goes on", () => {
    const early = walk(stopT(1)).lines.length;
    const late = walk(stopT(12)).lines.length;
    assert.ok(late > early);
  });

  it("shows the whole map with no packet at the end", () => {
    const end = walk(1);
    assert.equal(
      end.labels.some((label) => label.id.startsWith("skill-")),
      false
    );
    assert.ok(end.labels.some((label) => label.id === "trend"));
    assert.equal(
      end.labels.filter((label) => label.id.startsWith("phase-")).length,
      7
    );
  });

  it("keeps the current skill and its phase on a phone", () => {
    const scene = walk(stopT(7), 4);
    assert.equal(scene.labels.length, 4);
    assert.equal(scene.labels[0]?.id, "skill-7");
    assert.equal(scene.labels[1]?.id, `phase-${map.stops[7]?.phase ?? ""}`);
  });

  it("draws nothing for the map without the data", () => {
    const bare = buildScene("skills", 0.5, 1, sampleCounts);
    assert.equal(bare.plate, undefined);
  });
});

describe("frameMatrix", () => {
  it("keeps the slabs in the upper right of a desktop frame", () => {
    const scene = build("outro", 1, 1);
    const m = frameMatrix(1440 / 810, scene, 0, 0);
    const slabs = scene.labels.filter(({ id }) => id.startsWith("slab-"));
    assert.equal(slabs.length, 5);
    for (const { at } of slabs) {
      const [x, y] = project(m, at, 1440, 810);
      assert.ok(x > 1440 * 0.4 && x < 1440, `x ${String(x)}`);
      assert.ok(y > 0 && y < 810 * 0.75, `y ${String(y)}`);
    }
  });

  it("lifts a phone frame clear of the step text", () => {
    const scene = build("outro", 1, 1);
    const m = frameMatrix(390 / 844, scene, 0, 0);
    assert.equal(m[12], 0);
    assert.ok((m[13] ?? 0) > 0);
    for (const { at, id } of scene.labels) {
      if (!id.startsWith("slab-")) continue;
      const [, y] = project(m, at, 390, 844);
      assert.ok(y > 844 * 0.06 && y < 844 * 0.55, `y ${String(y)}`);
    }
  });

  it("does not lift a square frame", () => {
    const scene = build("outro", 1, 1);
    const m = frameMatrix(1, scene, 0, 0);
    assert.equal(m[12], 0);
    assert.equal(m[13], 0);
  });

  it("widens the view for a narrow frame", () => {
    const scene = build("c04", 0.5, 1);
    const wide = frameMatrix(1.6, scene, 0, 0);
    const narrow = frameMatrix(0.5, scene, 0, 0);
    assert.ok((narrow[5] ?? 1) < (wide[5] ?? 1));
  });
});

describe("the label limit", () => {
  const limit = 4;
  const limited = (step: StepId, t: number): Scene =>
    buildScene(step, t, 1, sampleCounts, limit);

  it("keeps the first labels by rank and no more", () => {
    for (const step of steps)
      for (const t of times) {
        const all = ids(build(step, t, 1));
        assert.deepEqual(ids(limited(step, t)), all.slice(0, limit));
      }
  });

  it("draws no leader for a label it drops", () => {
    const all = build("outro", 1, 1);
    const some = limited("outro", 1);
    assert.ok(all.labels.length > limit);
    assert.ok(some.lines.length < all.lines.length);
  });

  it("changes nothing while every label fits", () => {
    for (const step of steps)
      for (const t of times) {
        const all = build(step, t, 1);
        if (all.labels.length > limit) continue;
        assert.equal(limited(step, t).lines.length, all.lines.length);
      }
  });
});
